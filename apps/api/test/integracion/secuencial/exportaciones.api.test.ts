import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { inflateSync } from 'node:zlib';
import { Decimal } from 'decimal.js';
import ExcelJS from 'exceljs';
import sql from 'mssql';
import { pino } from 'pino';
import request, { type Response } from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import {
  crearProcesadorExportaciones,
  crearTareasDeExportaciones,
} from '../../../src/modules/exportaciones/index.js';
import { exportacionesRepository } from '../../../src/modules/exportaciones/exportaciones.repository.js';
import { REPORTES } from '../../../src/modules/reportes/index.js';
import { crearAlmacenEnDisco } from '../../../src/shared/adapters/almacen-disco.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba, SIN_CACHE } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion, registrar } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente, varianteVendible } from '../carrito/apoyo-carrito.js';
import {
  clienteConCarrito,
  iniciarPago,
  leerPedido,
  metodoEnvio,
  pagar,
} from '../checkout/apoyo-checkout.js';
import { comoActor, unaFila } from '../datos-de-prueba.js';
import { moverFechaPedido } from '../pedidos/apoyo-pedidos.js';

usarBaseDePruebas();

// Grupo secuencial: la cola de exportaciones es global y la toman las dos "réplicas".
// A-24: las dos réplicas comparten el almacén (en Docker, un volumen); cada una tiene su propio procesador.
const directorio = await mkdtemp(join(tmpdir(), 'exportaciones-'));
const almacen = crearAlmacenEnDisco(directorio);
const silencioso = pino({ level: 'silent' });
const procesador = () =>
  crearProcesadorExportaciones({ almacen, cache: SIN_CACHE, logger: silencioso });
const procesador1 = procesador();
const procesador2 = procesador();
const replica1 = crearApp(dependenciasDePrueba({ almacen, exportaciones: procesador1 }));
const replica2 = crearApp(dependenciasDePrueba({ almacen, exportaciones: procesador2 }));
// Una réplica que acepta solicitudes pero nunca las procesa (para el máximo de pendientes y la réplica que muere).
const sinProcesar = crearApp(
  dependenciasDePrueba({
    almacen,
    exportaciones: {
      procesarPendientes: () => Promise.resolve({ ...SIN_RESULTADOS }),
      detener: () => Promise.resolve(),
    },
  }),
);
const SIN_RESULTADOS = { completadas: 0, reintentos: 0, fallidas: 0, desplazadas: 0, errores: 0 };
const RUTA = '/api/v1/admin/exportaciones';

// Cada corrida usa un Administrador nuevo (la agrupación y el máximo de pendientes son por usuario) y un año
// propio para sus pedidos: repetirla sobre la misma base no se cruza con lo que dejó la anterior.
const ANIO = String(1950 + Math.floor(Math.random() * 50));
const enElAnio = (mesDia: string): string => `${ANIO}-${mesDia}`;

let adminSemilla: string;
let admin: string;
let estandar: number;

/** Un Administrador nuevo, creado por el Admin de la semilla. */
async function nuevoAdmin(nombre: string): Promise<string> {
  const correo = `admin-${randomUUID().slice(0, 8)}@ejemplo.gt`;
  await request(replica1)
    .post('/api/v1/usuarios')
    .set(comoCliente(adminSemilla))
    .send({ correo, contrasena: 'OtroAdmin2026!', nombre, rol: 'Administrador' });
  return leerSesion(await iniciarSesion(replica1, correo, 'OtroAdmin2026!')).accessToken;
}

beforeAll(async () => {
  adminSemilla = leerSesion(
    await iniciarSesion(replica1, 'admin@shopcart.gt', 'Admin2026!'),
  ).accessToken;
  admin = await nuevoAdmin('Admin Exportaciones');
  estandar = await metodoEnvio(replica1);
});

const exportacionSchema = z.object({
  idExportacion: z.number(),
  reporte: z.string(),
  formato: z.string(),
  estado: z.string(),
  error: z.string().nullable(),
  archivo: z.string().nullable(),
});
type ExportacionRecibida = z.infer<typeof exportacionSchema>;

const solicitar = (app: typeof replica1, reporte: string, cuerpo: object, token = admin) =>
  request(app)
    .post(`/api/v1/admin/reportes/${reporte}/exportaciones`)
    .set(comoCliente(token))
    .send(cuerpo);

const consultar = async (id: number, app = replica1, token = admin) =>
  leerDatos(
    await request(app)
      .get(`${RUTA}/${String(id)}`)
      .set(comoCliente(token)),
    exportacionSchema,
  );

/** Procesa la cola hasta que la exportación termine (el POST ya la empezó en segundo plano). */
async function hastaQueTermine(id: number, app = replica1): Promise<ExportacionRecibida> {
  for (let sondeo = 0; sondeo < 100; sondeo++) {
    const exportacion = await consultar(id, app);
    if (exportacion.estado !== 'Pendiente' && exportacion.estado !== 'Procesando')
      return exportacion;
    await procesador1.procesarPendientes();
    await new Promise((listo) => setTimeout(listo, 50));
  }
  throw new Error(`La exportación ${String(id)} no terminó a tiempo`);
}

const descargar = (id: number, app = replica1, token = admin) =>
  request(app)
    .get(`${RUTA}/${String(id)}/archivo`)
    .set(comoCliente(token))
    .buffer(true)
    .parse((respuesta, listo) => {
      const partes: Buffer[] = [];
      respuesta.on('data', (parte: Buffer) => partes.push(parte));
      respuesta.on('end', () => {
        listo(null, Buffer.concat(partes));
      });
    });

const cuerpoBinario = (respuesta: Response): Buffer => z.instanceof(Buffer).parse(respuesta.body);

/** Un pedido pagado de una variante en un día de Guatemala dado. */
async function pedidoEnDia(idVariante: number, cantidad: number, dia: string) {
  const cliente = await clienteConCarrito(replica1, [{ idVariante, cantidad }]);
  await iniciarPago(replica1, cliente, estandar);
  const pedido = leerPedido(await pagar(replica1, cliente.token, randomUUID()));
  await moverFechaPedido(pedido.idPedido, dia);
  return pedido;
}

/** El texto de un PDF: descomprime sus streams y lee los textos en hexadecimal que escribe pdfkit. */
function textoDelPdf(pdf: Buffer): string {
  const crudo = pdf.toString('latin1');
  const streams = [...crudo.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map((m) => {
    try {
      return inflateSync(Buffer.from(m[1] ?? '', 'latin1')).toString('latin1');
    } catch {
      return m[1] ?? '';
    }
  });
  return streams
    .flatMap((s) =>
      [...s.matchAll(/<([0-9a-fA-F]+)>/g)].map((m) =>
        Buffer.from(m[1] ?? '', 'hex').toString('latin1'),
      ),
    )
    .join('');
}

describe('exportación asíncrona de reportes (E7-H05, A-24)', () => {
  it('responde 202 de inmediato con Location y Retry-After, y el estado avanza hasta Completada', async () => {
    const respuesta = await solicitar(replica1, 'resumen', {
      formato: 'xlsx',
      filtros: { desde: enElAnio('01-01'), hasta: enElAnio('01-31') },
    });
    const solicitada = leerDatos(respuesta, exportacionSchema);

    expect(respuesta.status).toBe(202);
    expect(respuesta.get('Location')).toBe(`${RUTA}/${String(solicitada.idExportacion)}`);
    expect(respuesta.get('Retry-After')).toBe('2');
    expect(solicitada).toMatchObject({ estado: 'Pendiente', archivo: null });
    const terminada = await hastaQueTermine(solicitada.idExportacion);
    expect(terminada).toMatchObject({
      estado: 'Completada',
      archivo: `${RUTA}/${String(solicitada.idExportacion)}/archivo`,
    });
  });

  // La lista de reportes vive en un solo lugar (REPORTES); el CHECK de SolicitudExportacion.Reporte debe aceptarlos
  // todos, y cada uno se genera.
  it.each(REPORTES)('el reporte %s se exporta hasta Completada', async (reporte) => {
    const respuesta = await solicitar(replica1, reporte, {
      formato: 'pdf',
      filtros: { desde: enElAnio('02-01'), hasta: enElAnio('02-28') },
    });

    expect(respuesta.status).toBe(202);
    const { idExportacion } = leerDatos(respuesta, exportacionSchema);
    expect(await hastaQueTermine(idExportacion)).toMatchObject({ estado: 'Completada' });
  });

  it('una solicitud igual (los mismos filtros en otro orden) devuelve la misma exportación', async () => {
    const filtros = { desde: enElAnio('02-01'), hasta: enElAnio('02-28') };
    const primera = leerDatos(
      await solicitar(replica1, 'top-productos', { formato: 'pdf', filtros }),
      exportacionSchema,
    );
    await hastaQueTermine(primera.idExportacion);

    const segunda = leerDatos(
      await solicitar(replica2, 'top-productos', {
        formato: 'pdf',
        filtros: { hasta: enElAnio('02-28'), desde: enElAnio('02-01') },
      }),
      exportacionSchema,
    );
    const otroFormato = leerDatos(
      await solicitar(replica2, 'top-productos', { formato: 'xlsx', filtros }),
      exportacionSchema,
    );

    expect(segunda.idExportacion).toBe(primera.idExportacion);
    expect(otroFormato.idExportacion).not.toBe(primera.idExportacion);
    await hastaQueTermine(otroFormato.idExportacion);
  });

  it('el archivo que generó una réplica se descarga desde la otra, con un nombre del servidor', async () => {
    const solicitada = leerDatos(
      await solicitar(replica1, 'ventas', { formato: 'xlsx', filtros: { agrupacion: 'mes' } }),
      exportacionSchema,
    );
    await hastaQueTermine(solicitada.idExportacion);

    const respuesta = await descargar(solicitada.idExportacion, replica2);

    expect(respuesta.status).toBe(200);
    expect(respuesta.get('Content-Type')).toContain('spreadsheetml');
    expect(respuesta.get('Content-Disposition')).toMatch(
      /^attachment; filename="?ventas_\d{4}-\d{2}-\d{2}_\d{4}\.xlsx"?$/,
    );
    expect(cuerpoBinario(respuesta).subarray(0, 2).toString()).toBe('PK');
  });

  it('los totales del Excel y del PDF coinciden al centavo con el reporte JSON', async () => {
    const dia = enElAnio('03-10');
    const [a, b] = await Promise.all([varianteVendible('33.33', 20), varianteVendible('0.10', 20)]);
    await pedidoEnDia(a.IDVariante, 3, dia);
    await pedidoEnDia(b.IDVariante, 7, dia);
    const filtros = { desde: dia, hasta: dia };
    const json = leerDatos(
      await request(replica1)
        .get(`/api/v1/dashboard/ventas-por-categoria?desde=${dia}&hasta=${dia}`)
        .set(comoCliente(admin)),
      z.array(z.object({ unidades: z.number(), ventas: z.string() })),
    );
    const totalJson = json.reduce((total, c) => total.plus(c.ventas), new Decimal(0));

    const excel = leerDatos(
      await solicitar(replica1, 'ventas-por-categoria', { formato: 'xlsx', filtros }),
      exportacionSchema,
    );
    const pdf = leerDatos(
      await solicitar(replica1, 'ventas-por-categoria', { formato: 'pdf', filtros }),
      exportacionSchema,
    );
    await hastaQueTermine(excel.idExportacion);
    await hastaQueTermine(pdf.idExportacion);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.read(Readable.from([cuerpoBinario(await descargar(excel.idExportacion))]));
    const hoja = libro.worksheets[0];
    const totalExcel = hoja?.getCell(hoja.rowCount, 3).value;
    const textoPdf = textoDelPdf(cuerpoBinario(await descargar(pdf.idExportacion)));

    expect(totalJson.toFixed(2)).toBe('100.69');
    expect(totalExcel).toBe(100.69);
    expect(hoja?.getCell(3, 1).value).toMatch(
      /^Datos al \d{2}\/\d{2}\/\d{4} \d{2}:\d{2} \(hora de Guatemala\)$/,
    );
    expect(textoPdf).toContain('100.69');
    expect(textoPdf).toContain('Datos al');
  });

  it('un producto llamado "=HYPERLINK(...)" se exporta como texto, nunca como fórmula', async () => {
    const dia = enElAnio('04-10');
    const { IDVariante, IDProducto } = await varianteVendible('10.00', 5);
    const nombre = '=HYPERLINK("http://malo.example","clic")';
    await request(replica1)
      .patch(`/api/v1/admin/productos/${String(IDProducto)}`)
      .set(comoCliente(admin))
      .send({ nombre });
    await pedidoEnDia(IDVariante, 1, dia);

    const solicitada = leerDatos(
      await solicitar(replica1, 'top-productos', {
        formato: 'xlsx',
        filtros: { desde: dia, hasta: dia },
      }),
      exportacionSchema,
    );
    await hastaQueTermine(solicitada.idExportacion);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.read(
      Readable.from([cuerpoBinario(await descargar(solicitada.idExportacion))]),
    );
    const celda = libro.worksheets[0]?.getCell('A6');

    expect(celda?.type).toBe(ExcelJS.ValueType.String);
    expect(celda?.value).toBe(`'${nombre}`);
  });

  it('una réplica que muere a mitad: otra la retoma al vencer el arrendamiento y queda un solo archivo', async () => {
    await procesador1.procesarPendientes();
    const solicitada = leerDatos(
      await solicitar(sinProcesar, 'resumen', {
        formato: 'pdf',
        filtros: { desde: enElAnio('05-01'), hasta: enElAnio('05-31') },
      }),
      exportacionSchema,
    );
    // La "réplica muerta" la toma (Sistema) y nunca la completa; su arrendamiento vence.
    const muerta = await exportacionesRepository.tomar(120, 3);
    expect(muerta?.idExportacion).toBe(solicitada.idExportacion);
    await ejecutarSP('SP_Pruebas_ModificarExportacion', {
      IDSolicitudExportacion: { tipo: sql.Int, valor: solicitada.idExportacion },
      Cambio: { tipo: sql.VarChar(20), valor: 'VencerArrendamiento' },
    });

    await procesador2.procesarPendientes();
    const terminada = await consultar(solicitada.idExportacion, replica2);
    if (muerta === null) throw new Error('No se tomó la exportación');
    const tarde = await exportacionesRepository.completar(
      muerta,
      `${String(muerta.idExportacion)}-tarde.pdf`,
      10,
      24,
    );
    const archivos = (await readdir(directorio)).filter((a) =>
      a.startsWith(`${String(solicitada.idExportacion)}-`),
    );

    expect(terminada.estado).toBe('Completada');
    expect(tarde).toBe(false);
    expect(archivos).toHaveLength(1);
  });

  it('la de otro Administrador responde 404; un Operador o un Cliente, 403', async () => {
    const solicitada = leerDatos(
      await solicitar(replica1, 'resumen', { formato: 'xlsx', filtros: {} }),
      exportacionSchema,
    );
    const otroAdmin = await nuevoAdmin('Otro Admin');
    const operador = leerSesion(
      await iniciarSesion(replica1, 'operador@shopcart.gt', 'Operador2026!'),
    ).accessToken;
    const cliente = leerSesion(await registrar(replica1)).accessToken;

    const ajena = await request(replica1)
      .get(`${RUTA}/${String(solicitada.idExportacion)}`)
      .set(comoCliente(otroAdmin));
    const archivoAjeno = await descargar(solicitada.idExportacion, replica1, otroAdmin);
    const deOperador = await solicitar(
      replica1,
      'resumen',
      { formato: 'xlsx', filtros: {} },
      operador,
    );
    const deCliente = await request(replica1).get(RUTA).set(comoCliente(cliente));

    expect(leerError(ajena)).toMatchObject({ codigo: 'NO_ENCONTRADO' });
    expect(ajena.status).toBe(404);
    expect(archivoAjeno.status).toBe(404);
    expect(deOperador.status).toBe(403);
    expect(deCliente.status).toBe(403);
    await hastaQueTermine(solicitada.idExportacion);
  });

  it('la purga expira los archivos vencidos: la solicitud queda Expirada y el archivo ya no está', async () => {
    const solicitada = leerDatos(
      await solicitar(replica1, 'top-productos', {
        formato: 'xlsx',
        filtros: { desde: enElAnio('06-01'), hasta: enElAnio('06-30') },
      }),
      exportacionSchema,
    );
    await hastaQueTermine(solicitada.idExportacion);
    const { ReferenciaArchivo } = await unaFila<{ ReferenciaArchivo: string }>(
      'SP_Pruebas_ModificarExportacion',
      {
        IDSolicitudExportacion: { tipo: sql.Int, valor: solicitada.idExportacion },
        Cambio: { tipo: sql.VarChar(20), valor: 'VencerArchivo' },
      },
    );
    const purga = crearTareasDeExportaciones({
      procesador: procesador1,
      almacen,
      logger: silencioso,
    }).find((t) => t.nombre === 'Exportaciones.Purgar');

    await purga?.ejecutar();

    expect((await consultar(solicitada.idExportacion)).estado).toBe('Expirada');
    expect(await readdir(directorio)).not.toContain(ReferenciaArchivo);
    const archivo = await request(replica1)
      .get(`${RUTA}/${String(solicitada.idExportacion)}/archivo`)
      .set(comoCliente(admin));
    expect(archivo.status).toBe(410);
    expect(leerError(archivo)).toMatchObject({ codigo: 'EXPORTACION_EXPIRADA' });
  });

  it('la purga borra un archivo sin referencia de más de 24 h, nunca uno referenciado', async () => {
    const solicitada = leerDatos(
      await solicitar(replica1, 'ventas', { formato: 'pdf', filtros: { agrupacion: 'semana' } }),
      exportacionSchema,
    );
    await hastaQueTermine(solicitada.idExportacion);
    const referenciado = (await readdir(directorio)).find((a) =>
      a.startsWith(`${String(solicitada.idExportacion)}-`),
    );
    if (referenciado === undefined) throw new Error('No se generó el archivo');
    const huerfano = `999999-${randomUUID()}.xlsx`;
    await writeFile(join(directorio, huerfano), 'sin referencia');
    const haceDosDias = new Date(Date.now() - 48 * 3_600_000);
    await utimes(join(directorio, huerfano), haceDosDias, haceDosDias);
    await utimes(join(directorio, referenciado), haceDosDias, haceDosDias);
    const purga = crearTareasDeExportaciones({
      procesador: procesador1,
      almacen,
      logger: silencioso,
    }).find((t) => t.nombre === 'Exportaciones.Purgar');

    await purga?.ejecutar();
    const quedan = await readdir(directorio);

    expect(quedan).not.toContain(huerfano);
    expect(quedan).toContain(referenciado);
  });

  it('pasar el máximo de exportaciones en curso responde 429', async () => {
    const propio = await nuevoAdmin('Admin Limite');
    const pedir = (mes: number) =>
      solicitar(
        sinProcesar,
        'resumen',
        {
          formato: 'pdf',
          filtros: { desde: enElAnio(`0${String(mes)}-01`), hasta: enElAnio(`0${String(mes)}-28`) },
        },
        propio,
      );

    const aceptadas = [await pedir(1), await pedir(2), await pedir(3)];
    const cuarta = await pedir(4);

    expect(aceptadas.map((r) => r.status)).toEqual([202, 202, 202]);
    expect(cuarta.status).toBe(429);
    expect(leerError(cuarta)).toMatchObject({ codigo: 'EXPORTACIONES_PENDIENTES_MAXIMAS' });
    // Deja la cola vacía para las corridas siguientes.
    await procesador1.procesarPendientes();
    await procesador1.procesarPendientes();
  });

  it('E9-H01: la métrica de pendientes cuenta las solicitudes que esperan; solo el rol Sistema la lee', async () => {
    const propio = await nuevoAdmin('Admin Metrica');
    const antes = await exportacionesRepository.contarPendientes();

    const solicitud = await solicitar(
      sinProcesar,
      'resumen',
      { formato: 'xlsx', filtros: { desde: enElAnio('05-01'), hasta: enElAnio('05-28') } },
      propio,
    );
    const conUna = await exportacionesRepository.contarPendientes();
    await procesador1.procesarPendientes();
    const despues = await exportacionesRepository.contarPendientes();
    const comoAdmin = comoActor(1, 'Administrador', () =>
      exportacionesRepository.contarPendientes(),
    );

    expect(solicitud.status).toBe(202);
    expect([conUna - antes, despues - antes]).toEqual([1, 0]);
    await expect(comoAdmin).rejects.toMatchObject({ codigo: 'INVARIANTE_INTERNA' });
  });
});
