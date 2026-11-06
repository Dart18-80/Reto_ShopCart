import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { varianteVendible } from '../carrito/apoyo-carrito.js';
import {
  conToken,
  crearAtributo,
  crearCategoria,
  crearProducto,
  crearVariante,
} from '../catalogo/apoyo-catalogo.js';
import { clienteConCarrito, metodoEnvio } from '../checkout/apoyo-checkout.js';
import { comoActor, unaFila } from '../datos-de-prueba.js';
import { pedidoPagado } from '../pedidos/apoyo-pedidos.js';

usarBaseDePruebas();

// Grupo secuencial (M6-H01): nadie más inserta filas mientras se recorren todas las páginas de un listado, así
// el orden y la estabilidad de la paginación se pueden verificar sobre el listado completo.

const app = crearApp(dependenciasDePrueba());
const TAMANO = 100;
const DIA_MS = 24 * 60 * 60 * 1000;
let token: string;
let idAdmin: number;
let estandar: number;

beforeAll(async () => {
  const sesion = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!'));
  token = sesion.accessToken;
  idAdmin = sesion.usuario.idUsuario;
  estandar = await metodoEnvio(app);
});

const paginaSchema = z.object({
  datos: z.array(z.looseObject({})),
  paginacion: z.object({ total: z.number(), totalPaginas: z.number() }),
});

const consultar = (ruta: string, consulta: Record<string, string>) =>
  request(app)
    .get(`${ruta}?${new URLSearchParams(consulta).toString()}`)
    .set(conToken(token));

/**
 * Todas las filas del listado, página por página. La paginación es estable: ninguna fila se repite y la suma de
 * las páginas es el total que informa el servidor.
 */
async function todas<T>(
  ruta: string,
  consulta: Record<string, string>,
  fila: z.ZodType<T>,
  clave: (fila: T) => string | number,
): Promise<T[]> {
  const filas: T[] = [];
  for (let pagina = 1; ; pagina++) {
    const respuesta = await consultar(ruta, {
      ...consulta,
      pagina: String(pagina),
      tamano: String(TAMANO),
    });
    expect(respuesta.status, JSON.stringify(respuesta.body)).toBe(200);
    const { datos, paginacion } = paginaSchema.parse(respuesta.body);
    filas.push(...datos.map((dato) => fila.parse(dato)));
    if (pagina >= paginacion.totalPaginas) {
      expect(filas).toHaveLength(paginacion.total);
      break;
    }
  }
  expect(new Set(filas.map(clave)).size).toBe(filas.length);
  return filas;
}

/** El orden relativo de las filas propias de la prueba dentro del listado completo. */
const propias = <T>(filas: T[], clave: (fila: T) => string | number, ids: (string | number)[]) =>
  filas.map(clave).filter((id) => ids.includes(id));

const noDecrece = (valores: number[]) =>
  valores.every((v, i) => i === 0 || (valores[i - 1] ?? v) <= v);
const noCrece = (valores: number[]) =>
  valores.every((v, i) => i === 0 || (valores[i - 1] ?? v) >= v);

const RUTAS = [
  '/api/v1/admin/pedidos',
  '/api/v1/admin/productos',
  '/api/v1/inventario/existencias',
  '/api/v1/usuarios',
  '/api/v1/admin/cupones',
  '/api/v1/bitacora',
  '/api/v1/dashboard/carritos-abandonados',
];

describe('orden del servidor en los listados del backoffice (M6-H01)', () => {
  it.each(RUTAS)(
    '%s: un orden fuera de la lista blanca responde 400 con la forma estándar',
    async (ruta) => {
      const respuesta = await consultar(ruta, { orden: 'IDUsuario; DROP TABLE Pedido' });

      expect(respuesta.status).toBe(400);
      expect(leerError(respuesta).detalles).toEqual({
        errores: [expect.objectContaining({ campo: 'query.orden' }) as unknown],
      });
    },
  );

  it.each(RUTAS)('%s: una dirección que no es asc ni desc responde 400', async (ruta) => {
    const respuesta = await consultar(ruta, { direccion: 'arriba' });

    expect(respuesta.status).toBe(400);
    expect(leerError(respuesta).detalles).toEqual({
      errores: [expect.objectContaining({ campo: 'query.direccion' }) as unknown],
    });
  });

  // A-02: el SP es la autoridad; un NULL explícito (no el parámetro omitido) también se rechaza.
  const PAGINA = {
    Pagina: { tipo: sql.Int, valor: 1 },
    Tamano: { tipo: sql.Int, valor: 20 },
  };
  it.each([
    ['SP_Pedidos_Listar', {}],
    [
      'SP_Catalogo_ListarProductosAdmin',
      {
        ...PAGINA,
        IDCategoria: { tipo: sql.Int, valor: null },
        Activo: { tipo: sql.Bit, valor: null },
        Texto: { tipo: sql.NVarChar(150), valor: null },
      },
    ],
    ['SP_Inventario_ListarExistencias', { ...PAGINA, IDVariante: { tipo: sql.Int, valor: null } }],
    [
      'SP_Usuarios_Listar',
      {
        ...PAGINA,
        Rol: { tipo: sql.VarChar(20), valor: null },
        Activo: { tipo: sql.Bit, valor: null },
      },
    ],
    ['SP_Cupones_Listar', {}],
    ['SP_Bitacora_Listar', {}],
    ['SP_Dashboard_CarritosAbandonados', {}],
  ] as const)('%s rechaza @Orden o @Direccion en NULL (50003)', async (nombre, parametros) => {
    for (const nulo of ['Orden', 'Direccion']) {
      await expect(
        comoActor(idAdmin, 'Administrador', () =>
          ejecutarSP(nombre, { ...parametros, [nulo]: { tipo: sql.VarChar(20), valor: null } }),
        ),
      ).rejects.toMatchObject({ codigo: 'PARAMETRO_INVALIDO' });
    }
  });

  it('pedidos: por total, por fecha, por número y por estado, en las dos direcciones', async () => {
    const { cliente, pedido: primero } = await pedidoPagado(app, estandar, {
      lineas: [{ precio: '30.00', cantidad: 1 }],
    });
    const { pedido: segundo } = await pedidoPagado(app, estandar, {
      cliente,
      lineas: [{ precio: '10.00', cantidad: 1 }],
    });
    const { pedido: tercero } = await pedidoPagado(app, estandar, {
      cliente,
      lineas: [{ precio: '20.00', cantidad: 1 }],
    });
    await request(app)
      .post(`/api/v1/admin/pedidos/${String(segundo.idPedido)}/estado`)
      .set(conToken(token))
      .send({ estadoEsperado: 'Pagado', estadoNuevo: 'EnPreparacion' });
    const fila = z.object({ idPedido: z.number() });
    const ids = (orden: string, direccion: string) =>
      todas(
        '/api/v1/admin/pedidos',
        { idCliente: String(cliente.idUsuario), orden, direccion },
        fila,
        (f) => f.idPedido,
      ).then((filas) => filas.map((f) => f.idPedido));
    const [p1, p2, p3] = [primero.idPedido, segundo.idPedido, tercero.idPedido];

    expect(await ids('total', 'asc')).toEqual([p2, p3, p1]);
    expect(await ids('total', 'desc')).toEqual([p1, p3, p2]);
    expect(await ids('fecha', 'asc')).toEqual([p1, p2, p3]);
    expect(await ids('fecha', 'desc')).toEqual([p3, p2, p1]);
    expect(await ids('numero', 'asc')).toEqual([p1, p2, p3]);
    expect(await ids('numero', 'desc')).toEqual([p3, p2, p1]);
    // Pagado (Orden 1) antes que EnPreparacion (2); el desempate sigue la dirección.
    expect(await ids('estado', 'asc')).toEqual([p1, p3, p2]);
    expect(await ids('estado', 'desc')).toEqual([p2, p3, p1]);
    // Sin orden, el de siempre: los más recientes primero.
    expect(
      paginaSchema
        .parse(
          (await consultar('/api/v1/admin/pedidos', { idCliente: String(cliente.idUsuario) })).body,
        )
        .datos.map((d) => fila.parse(d).idPedido),
    ).toEqual([p3, p2, p1]);
  });

  it('productos: por nombre, por categoría y por recientes, en las dos direcciones', async () => {
    const marca = `Orden${randomUUID().slice(0, 8)}`;
    const categoria = async (nombre: string) =>
      leerDatos(
        await request(app)
          .post('/api/v1/admin/categorias')
          .set(conToken(token))
          .send({ nombre: `${marca} ${nombre}` }),
        z.object({ idCategoria: z.number() }),
      ).idCategoria;
    const zeta = await categoria('Zeta');
    const alfa = await categoria('Alfa');
    const b = await crearProducto(app, token, alfa, { nombre: `${marca} B` });
    const a = await crearProducto(app, token, zeta, { nombre: `${marca} A` });
    const c = await crearProducto(app, token, alfa, { nombre: `${marca} C` });
    const fila = z.object({ idProducto: z.number() });
    const ids = (orden: string, direccion: string) =>
      todas(
        '/api/v1/admin/productos',
        { texto: marca, orden, direccion },
        fila,
        (f) => f.idProducto,
      ).then((filas) => filas.map((f) => f.idProducto));
    const [pa, pb, pc] = [a.idProducto, b.idProducto, c.idProducto];

    expect(await ids('nombre', 'asc')).toEqual([pa, pb, pc]);
    expect(await ids('nombre', 'desc')).toEqual([pc, pb, pa]);
    expect(await ids('categoria', 'asc')).toEqual([pb, pc, pa]);
    expect(await ids('categoria', 'desc')).toEqual([pa, pc, pb]);
    expect(await ids('recientes', 'asc')).toEqual([pb, pa, pc]);
    expect(await ids('recientes', 'desc')).toEqual([pc, pa, pb]);
  });

  it('existencias: por disponible y por SKU, en las dos direcciones, con la paginación estable', async () => {
    const marca = `0ORD${randomUUID().slice(0, 6)}`;
    const { idProducto } = await crearProducto(app, token, await crearCategoria(app, token));
    const { valores } = await crearAtributo(app, token, ['A', 'B', 'C']);
    const sku = async (letra: 'A' | 'B' | 'C') =>
      leerDatos(
        await crearVariante(app, token, idProducto, [valores[letra] ?? 0], {
          sku: `${marca}-${letra}`,
        }),
        z.object({ variantes: z.array(z.object({ idVariante: z.number(), sku: z.string() })) }),
      ).variantes.find((v) => v.sku === `${marca}-${letra}`)?.idVariante ?? 0;
    const vb = await sku('B');
    const va = await sku('A');
    const vc = await sku('C');
    const fila = z.object({ idVariante: z.number(), disponible: z.number() });
    const listado = (orden: string, direccion: string) =>
      todas('/api/v1/inventario/existencias', { orden, direccion }, fila, (f) => f.idVariante);

    expect(noDecrece((await listado('disponible', 'asc')).map((f) => f.disponible))).toBe(true);
    expect(noCrece((await listado('disponible', 'desc')).map((f) => f.disponible))).toBe(true);
    expect(propias(await listado('sku', 'asc'), (f) => f.idVariante, [va, vb, vc])).toEqual([
      va,
      vb,
      vc,
    ]);
    expect(propias(await listado('sku', 'desc'), (f) => f.idVariante, [va, vb, vc])).toEqual([
      vc,
      vb,
      va,
    ]);
  });

  it('usuarios: por nombre y por recientes, en las dos direcciones', async () => {
    const marca = `Orden${randomUUID().slice(0, 8)}`;
    const crear = async (letra: string) =>
      leerDatos(
        await request(app)
          .post('/api/v1/usuarios')
          .set(conToken(token))
          .send({
            correo: `${marca.toLowerCase()}${letra.toLowerCase()}@prueba.gt`,
            contrasena: 'Operador2026!',
            nombre: `${marca} ${letra}`,
            rol: 'Operador',
          }),
        z.object({ idUsuario: z.number() }),
      ).idUsuario;
    const ub = await crear('B');
    const ua = await crear('A');
    const uc = await crear('C');
    const fila = z.object({ idUsuario: z.number() });
    const orden = async (columna: string, direccion: string) =>
      propias(
        await todas(
          '/api/v1/usuarios',
          { rol: 'Operador', orden: columna, direccion },
          fila,
          (f) => f.idUsuario,
        ),
        (f) => f.idUsuario,
        [ua, ub, uc],
      );

    expect(await orden('nombre', 'asc')).toEqual([ua, ub, uc]);
    expect(await orden('nombre', 'desc')).toEqual([uc, ub, ua]);
    expect(await orden('recientes', 'asc')).toEqual([ub, ua, uc]);
    expect(await orden('recientes', 'desc')).toEqual([uc, ua, ub]);
  });

  it('cupones: por código y por vigencia (FechaInicio), en las dos direcciones', async () => {
    const marca = `ORD${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`;
    const crear = async (letra: string, diasAtras: number) =>
      leerDatos(
        await request(app)
          .post('/api/v1/admin/cupones')
          .set(conToken(token))
          .send({
            codigo: `${marca}${letra}`,
            descripcion: 'Cupón del orden',
            tipo: 'MontoFijo',
            valor: '5.00',
            fechaInicio: new Date(Date.now() - diasAtras * DIA_MS).toISOString(),
            fechaFin: new Date(Date.now() + DIA_MS).toISOString(),
            limiteUsosTotal: 5,
          }),
        z.object({ idCupon: z.number() }),
      ).idCupon;
    const cb = await crear('B', 1);
    const ca = await crear('A', 3);
    const cc = await crear('C', 2);
    const fila = z.object({ idCupon: z.number() });
    const orden = async (columna: string, direccion: string) =>
      propias(
        await todas('/api/v1/admin/cupones', { orden: columna, direccion }, fila, (f) => f.idCupon),
        (f) => f.idCupon,
        [ca, cb, cc],
      );

    expect(await orden('codigo', 'asc')).toEqual([ca, cb, cc]);
    expect(await orden('codigo', 'desc')).toEqual([cc, cb, ca]);
    expect(await orden('vigencia', 'asc')).toEqual([ca, cc, cb]);
    expect(await orden('vigencia', 'desc')).toEqual([cb, cc, ca]);
  });

  it('bitácora: por fecha, en las dos direcciones, con la paginación estable', async () => {
    const fila = z.object({ idBitacora: z.string(), fecha: z.string() });
    const fechas = async (direccion: string) =>
      (
        await todas(
          '/api/v1/bitacora',
          { modulo: 'Cupones', orden: 'fecha', direccion },
          fila,
          (f) => f.idBitacora,
        )
      ).map((f) => Date.parse(f.fecha));

    expect(noDecrece(await fechas('asc'))).toBe(true);
    expect(noCrece(await fechas('desc'))).toBe(true);
  });

  it('carritos abandonados: por inactividad y por total, en las dos direcciones', async () => {
    const abandonado = async (precio: string, dias: number) => {
      const { IDVariante } = await varianteVendible(precio, 10);
      const cliente = await clienteConCarrito(app, [{ idVariante: IDVariante, cantidad: 1 }]);
      const { IDCarrito } = await unaFila<{ IDCarrito: number }>('SP_Pruebas_LeerCarritos', {
        IDUsuario: { tipo: sql.Int, valor: cliente.idUsuario },
      });
      await ejecutarSP('SP_Pruebas_EnvejecerCarrito', {
        IDCarrito: { tipo: sql.Int, valor: IDCarrito },
        Dias: { tipo: sql.Int, valor: dias },
      });
      return IDCarrito;
    };
    const c1 = await abandonado('10.00', 3);
    const c2 = await abandonado('30.00', 4);
    const c3 = await abandonado('20.00', 2);
    const dia = async (diasAtras: number) =>
      (
        await unaFila<{ FechaLocal: string }>('SP_Pruebas_FechaLocal', {
          FechaUtc: { tipo: sql.DateTime2(3), valor: new Date(Date.now() - diasAtras * DIA_MS) },
        })
      ).FechaLocal;
    const rango = { desde: await dia(5), hasta: await dia(0) };
    const fila = z.object({ idCarrito: z.number() });
    const orden = async (columna: string, direccion: string) =>
      propias(
        await todas(
          '/api/v1/dashboard/carritos-abandonados',
          { ...rango, orden: columna, direccion },
          fila,
          (f) => f.idCarrito,
        ),
        (f) => f.idCarrito,
        [c1, c2, c3],
      );

    // Más inactividad es una última actividad más antigua.
    expect(await orden('inactividad', 'desc')).toEqual([c2, c1, c3]);
    expect(await orden('inactividad', 'asc')).toEqual([c3, c1, c2]);
    expect(await orden('total', 'desc')).toEqual([c2, c3, c1]);
    expect(await orden('total', 'asc')).toEqual([c1, c3, c2]);
  });
});
