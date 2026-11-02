import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion, registrar } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { varianteVendible } from '../carrito/apoyo-carrito.js';
import { conToken, crearCategoria } from '../catalogo/apoyo-catalogo.js';
import { crearUsuario, leerBitacora, unaFila } from '../datos-de-prueba.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const RUTA = '/api/v1/admin/cupones';
const ID_INEXISTENTE = 2_147_483_647;
const DIA_MS = 24 * 60 * 60 * 1000;

const cuponSchema = z.strictObject({
  idCupon: z.number(),
  codigo: z.string(),
  descripcion: z.string(),
  tipo: z.enum(['Porcentaje', 'MontoFijo']),
  valor: z.string(),
  montoMaximoDescuento: z.string().nullable(),
  montoMinimoCompra: z.string(),
  categoria: z.object({ idCategoria: z.number(), nombre: z.string() }).nullable(),
  fechaInicio: z.string(),
  fechaFin: z.string(),
  limiteUsosTotal: z.number(),
  limiteUsosPorCliente: z.number(),
  usosComprometidos: z.number(),
  usado: z.boolean(),
  activo: z.boolean(),
});
type CuponRecibido = z.infer<typeof cuponSchema>;

let admin: { token: string; idUsuario: number };

beforeAll(async () => {
  const sesion = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!'));
  admin = { token: sesion.accessToken, idUsuario: sesion.usuario.idUsuario };
});

const codigoUnico = () => `c${randomUUID().replaceAll('-', '').slice(0, 12)}`;

const cuerpoValido = (cambios: Record<string, unknown> = {}) => ({
  codigo: codigoUnico(),
  descripcion: 'Descuento de prueba',
  tipo: 'MontoFijo',
  valor: '10.00',
  fechaInicio: new Date().toISOString(),
  fechaFin: new Date(Date.now() + 30 * DIA_MS).toISOString(),
  limiteUsosTotal: 5,
  ...cambios,
});

const crear = (cambios: Record<string, unknown> = {}) =>
  request(app).post(RUTA).set(conToken(admin.token)).send(cuerpoValido(cambios));

const actualizar = (idCupon: number, cambios: Record<string, unknown>) =>
  request(app)
    .patch(`${RUTA}/${String(idCupon)}`)
    .set(conToken(admin.token))
    .send(cambios);

async function cuponNuevo(cambios: Record<string, unknown> = {}): Promise<CuponRecibido> {
  const respuesta = await crear(cambios);
  expect(respuesta.status).toBe(201);
  return leerDatos(respuesta, cuponSchema);
}

/** N-12: un uso reservado en una sesión de checkout de un cliente nuevo. */
async function usarCupon(idCupon: number): Promise<void> {
  const { IDVariante } = await varianteVendible();
  await unaFila('SP_Pruebas_CrearSesionConReserva', {
    IDUsuario: { tipo: sql.Int, valor: await crearUsuario() },
    IDVariante: { tipo: sql.Int, valor: IDVariante },
    Cantidad: { tipo: sql.Int, valor: 1 },
    IDCupon: { tipo: sql.Int, valor: idCupon },
  });
}

describe('crear cupones (E4-H04, N-12)', () => {
  it('guarda el código en mayúsculas y responde los montos como texto', async () => {
    const codigo = `verano-${randomUUID().slice(0, 8)}`;

    const cupon = await cuponNuevo({
      codigo,
      tipo: 'Porcentaje',
      valor: '15',
      montoMaximoDescuento: '50.5',
      montoMinimoCompra: '100',
      limiteUsosPorCliente: 2,
    });

    expect(cupon).toMatchObject({
      codigo: codigo.toUpperCase(),
      tipo: 'Porcentaje',
      valor: '15.00',
      montoMaximoDescuento: '50.50',
      montoMinimoCompra: '100.00',
      categoria: null,
      limiteUsosTotal: 5,
      limiteUsosPorCliente: 2,
      usosComprometidos: 0,
      usado: false,
      activo: true,
    });
  });

  it('el código es único sin distinguir mayúsculas: 409 CUPON_CODIGO_DUPLICADO', async () => {
    const codigo = codigoUnico();
    await cuponNuevo({ codigo });

    const respuesta = await crear({ codigo: codigo.toUpperCase() });

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta).codigo).toBe('CUPON_CODIGO_DUPLICADO');
  });

  it('dos altas simultáneas del mismo código con otras mayúsculas: una crea y otra 409, nunca 500', async () => {
    const codigo = codigoUnico();

    const respuestas = await Promise.all([
      crear({ codigo }),
      crear({ codigo: codigo.toUpperCase() }),
    ]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('con categoría responde su nombre; una categoría inexistente responde 404', async () => {
    const idCategoria = await crearCategoria(app, admin.token);

    const cupon = await cuponNuevo({ idCategoria });
    const inexistente = await crear({ idCategoria: ID_INEXISTENTE });

    expect(cupon.categoria?.idCategoria).toBe(idCategoria);
    expect(inexistente.status).toBe(404);
  });

  it.each([
    ['un porcentaje mayor que 100', { tipo: 'Porcentaje', valor: '100.01' }],
    ['un valor de cero', { valor: '0' }],
    ['un monto con tres decimales', { valor: '1.005' }],
    ['un tope de descuento en un cupón de monto fijo', { montoMaximoDescuento: '5' }],
    ['una vigencia al revés', { fechaFin: new Date(Date.now() - DIA_MS).toISOString() }],
    ['un código con espacios', { codigo: 'con espacio' }],
    ['un código de dos caracteres', { codigo: 'ab' }],
    ['un límite de cero', { limiteUsosTotal: 0 }],
    ['un campo extra', { usosComprometidos: 3 }],
  ])('rechaza %s con 400', async (_caso, cambios) => {
    const respuesta = await crear(cambios);

    expect(respuesta.status).toBe(400);
    expect(leerError(respuesta).codigo).toBe('VALIDACION_FALLIDA');
  });
});

describe('editar cupones (E4-H04, N-12)', () => {
  it('sin usos se puede cambiar el tipo y el valor', async () => {
    const { idCupon } = await cuponNuevo();

    const respuesta = await actualizar(idCupon, { tipo: 'Porcentaje', valor: '20' });

    expect(leerDatos(respuesta, cuponSchema)).toMatchObject({ tipo: 'Porcentaje', valor: '20.00' });
  });

  it('con usos no cambia tipo ni valor (409 CUPON_USADO_NO_EDITABLE) y queda como estaba', async () => {
    const { idCupon } = await cuponNuevo();
    await usarCupon(idCupon);

    const tipo = await actualizar(idCupon, { tipo: 'Porcentaje' });
    const valor = await actualizar(idCupon, { valor: '11.00' });
    const consulta = await request(app)
      .get(`${RUTA}/${String(idCupon)}`)
      .set(conToken(admin.token));

    expect([tipo.status, valor.status]).toEqual([409, 409]);
    expect(leerError(valor).codigo).toBe('CUPON_USADO_NO_EDITABLE');
    expect(leerDatos(consulta, cuponSchema)).toMatchObject({
      tipo: 'MontoFijo',
      valor: '10.00',
      usado: true,
      usosComprometidos: 1,
    });
  });

  it('con usos sí cambian la vigencia, los límites y el estado (y el mismo valor no cuenta como cambio)', async () => {
    const { idCupon } = await cuponNuevo();
    await usarCupon(idCupon);
    const fechaFin = new Date(Date.now() + 60 * DIA_MS).toISOString();

    const cambio = await actualizar(idCupon, {
      fechaFin,
      limiteUsosTotal: 9,
      limiteUsosPorCliente: 3,
      valor: '10.00',
    });
    const desactivado = await request(app)
      .post(`${RUTA}/${String(idCupon)}/desactivar`)
      .set(conToken(admin.token));

    expect(leerDatos(cambio, cuponSchema)).toMatchObject({
      fechaFin,
      limiteUsosTotal: 9,
      limiteUsosPorCliente: 3,
    });
    expect(leerDatos(desactivado, cuponSchema).activo).toBe(false);
  });

  it('bajar el límite total por debajo de los usos comprometidos responde 422 con los usos', async () => {
    const { idCupon } = await cuponNuevo({ limiteUsosTotal: 5 });
    await ejecutarSP('SP_Pruebas_FijarUsosCupon', {
      IDCupon: { tipo: sql.Int, valor: idCupon },
      UsosComprometidos: { tipo: sql.Int, valor: 3 },
    });

    const bajo = await actualizar(idCupon, { limiteUsosTotal: 2 });
    const justo = await actualizar(idCupon, { limiteUsosTotal: 3 });

    expect(bajo.status).toBe(422);
    expect(leerError(bajo)).toMatchObject({
      codigo: 'CUPON_LIMITE_BAJO_USOS',
      detalles: { usosComprometidos: 3 },
    });
    expect(leerDatos(justo, cuponSchema).limiteUsosTotal).toBe(3);
  });

  it('null en el tope de descuento o en la categoría los quita', async () => {
    const idCategoria = await crearCategoria(app, admin.token);
    const { idCupon } = await cuponNuevo({
      tipo: 'Porcentaje',
      valor: '10',
      montoMaximoDescuento: '25',
      idCategoria,
    });

    const respuesta = await actualizar(idCupon, { montoMaximoDescuento: null, idCategoria: null });

    expect(leerDatos(respuesta, cuponSchema)).toMatchObject({
      montoMaximoDescuento: null,
      categoria: null,
    });
  });

  it('pasar a monto fijo con un tope de descuento guardado responde 400, no 500', async () => {
    const { idCupon } = await cuponNuevo({
      tipo: 'Porcentaje',
      valor: '10',
      montoMaximoDescuento: '5',
    });

    const respuesta = await actualizar(idCupon, { tipo: 'MontoFijo' });

    expect(respuesta.status).toBe(400);
  });

  it('cambiar a un código que ya existe responde 409', async () => {
    const existente = await cuponNuevo();
    const { idCupon } = await cuponNuevo();

    const respuesta = await actualizar(idCupon, { codigo: existente.codigo.toLowerCase() });

    expect(leerError(respuesta).codigo).toBe('CUPON_CODIGO_DUPLICADO');
  });

  it('un cupón inexistente responde 404 y un PATCH vacío 400', async () => {
    const inexistente = await actualizar(ID_INEXISTENTE, { descripcion: 'x' });
    const vacio = await actualizar((await cuponNuevo()).idCupon, {});

    expect([inexistente.status, vacio.status]).toEqual([404, 400]);
  });
});

describe('estado, listado, bitácora y permisos (E4-H04, RF-05, RF-09)', () => {
  it('activar y desactivar son idempotentes y el listado filtra por estado', async () => {
    const { idCupon } = await cuponNuevo({ activo: false });

    const primera = await request(app)
      .post(`${RUTA}/${String(idCupon)}/activar`)
      .set(conToken(admin.token));
    const segunda = await request(app)
      .post(`${RUTA}/${String(idCupon)}/activar`)
      .set(conToken(admin.token));
    const activos = await request(app)
      .get(`${RUTA}?activo=true&tamano=100`)
      .set(conToken(admin.token));

    expect([primera.status, segunda.status]).toEqual([200, 200]);
    expect(leerDatos(segunda, cuponSchema).activo).toBe(true);
    const listado = z
      .object({ datos: z.array(cuponSchema), paginacion: z.object({ total: z.number() }) })
      .parse(activos.body);
    expect(listado.datos.map((c) => c.idCupon)).toContain(idCupon);
    expect(listado.datos.every((c) => c.activo)).toBe(true);
  });

  it('crear, editar y desactivar quedan en la bitácora con el Admin que lo hizo', async () => {
    const { idCupon } = await cuponNuevo();
    await actualizar(idCupon, { descripcion: 'Otra descripción' });
    await request(app)
      .post(`${RUTA}/${String(idCupon)}/desactivar`)
      .set(conToken(admin.token));
    await request(app)
      .post(`${RUTA}/${String(idCupon)}/desactivar`)
      .set(conToken(admin.token));

    const bitacora = await leerBitacora('Cupon', idCupon);

    expect(bitacora.map((fila) => fila.Accion)).toEqual(['Desactivar', 'Modificar', 'Crear']);
    expect(bitacora.every((fila) => fila.IDUsuario === admin.idUsuario)).toBe(true);
  });

  it('el Operador y el Cliente reciben 403', async () => {
    const operador = leerSesion(await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'));
    const cliente = leerSesion(await registrar(app));

    const respuestas = await Promise.all(
      [operador.accessToken, cliente.accessToken].map((token) =>
        request(app).get(RUTA).set(conToken(token)),
      ),
    );

    expect(respuestas.map((r) => r.status)).toEqual([403, 403]);
  });
});
