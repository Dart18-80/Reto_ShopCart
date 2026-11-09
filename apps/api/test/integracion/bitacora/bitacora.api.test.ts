import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente } from '../carrito/apoyo-carrito.js';
import { crearCupon } from '../checkout/apoyo-checkout.js';
import { crearProducto, sufijo } from '../catalogo/apoyo-catalogo.js';
import { leerDatos } from '../../unit/respuestas.js';
import { unaFila } from '../datos-de-prueba.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
let admin: { token: string; idUsuario: number };
let tokenOperador: string;

beforeAll(async () => {
  const sesion = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!'));
  admin = { token: sesion.accessToken, idUsuario: sesion.usuario.idUsuario };
  tokenOperador = leerSesion(
    await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
  ).accessToken;
});

const paginaSchema = z.object({
  datos: z.array(
    z.object({
      idBitacora: z.string(),
      modulo: z.string(),
      entidad: z.string(),
      idEntidad: z.string(),
      accion: z.string(),
      valorAnterior: z.unknown(),
      valorNuevo: z.unknown(),
      usuario: z.object({ idUsuario: z.number(), nombre: z.string() }).nullable(),
      fecha: z.string(),
    }),
  ),
  paginacion: z.object({ pagina: z.number(), tamano: z.number(), total: z.number() }),
});

const bitacora = async (consulta: string, token = admin.token) =>
  paginaSchema.parse(
    (await request(app).get(`/api/v1/bitacora?${consulta}`).set(comoCliente(token))).body,
  );

const hoyEnGuatemala = async () =>
  (
    await unaFila<{ FechaLocal: string }>('SP_Pruebas_FechaLocal', {
      FechaUtc: { tipo: sql.DateTime2(3), valor: new Date() },
    })
  ).FechaLocal;

/** Una categoría con un nombre conocido, para leerlo después en la bitácora. */
async function categoria(prefijo: string) {
  const nombre = `${prefijo} ${sufijo()}`;
  const respuesta = await request(app)
    .post('/api/v1/admin/categorias')
    .set(comoCliente(admin.token))
    .send({ nombre });
  return {
    nombre,
    idCategoria: leerDatos(respuesta, z.object({ idCategoria: z.number() })).idCategoria,
  };
}

async function ultimoCambio(modulo: string, entidad: string, idEntidad: number) {
  const { datos } = await bitacora(`modulo=${modulo}&entidad=${entidad}&tamano=100`);
  const cambio = datos.find((r) => r.idEntidad === String(idEntidad) && r.accion === 'Modificar');
  if (!cambio)
    throw new Error(`No hay un cambio de ${entidad} ${String(idEntidad)} en la bitácora`);
  return cambio;
}

describe('la categoría en la bitácora (M10-H02, decisión del PO al cerrar M11)', () => {
  it('mover un producto de categoría registra el ID y el nombre de las dos: «Categoría: X → Y»', async () => {
    const origen = await categoria('Origen');
    const destino = await categoria('Destino');
    const producto = await crearProducto(app, admin.token, origen.idCategoria);

    await request(app)
      .patch(`/api/v1/admin/productos/${String(producto.idProducto)}`)
      .set(comoCliente(admin.token))
      .send({ idCategoria: destino.idCategoria });

    const cambio = await ultimoCambio('Catalogo', 'Producto', producto.idProducto);
    expect(cambio.valorAnterior).toMatchObject({
      IDCategoria: origen.idCategoria,
      Categoria: origen.nombre,
    });
    expect(cambio.valorNuevo).toMatchObject({
      IDCategoria: destino.idCategoria,
      Categoria: destino.nombre,
    });
  });

  it('cambiar el alcance de un cupón registra la categoría de antes y la de después', async () => {
    const antes = await categoria('Alcance');
    const despues = await categoria('Alcance nuevo');
    const { idCupon } = await crearCupon(app, admin.token, {
      limiteUsosTotal: 2,
      idCategoria: antes.idCategoria,
    });

    await request(app)
      .patch(`/api/v1/admin/cupones/${String(idCupon)}`)
      .set(comoCliente(admin.token))
      .send({ idCategoria: despues.idCategoria });

    const cambio = await ultimoCambio('Cupones', 'Cupon', idCupon);
    expect(cambio.valorAnterior).toMatchObject({
      IDCategoria: antes.idCategoria,
      Categoria: antes.nombre,
    });
    expect(cambio.valorNuevo).toMatchObject({
      IDCategoria: despues.idCategoria,
      Categoria: despues.nombre,
    });
  });

  it('un cupón para toda la tienda no tiene categoría: el campo no aparece', async () => {
    const { idCupon } = await crearCupon(app, admin.token, { limiteUsosTotal: 2 });

    const { datos } = await bitacora('modulo=Cupones&entidad=Cupon&tamano=100');
    const alta = datos.find((r) => r.idEntidad === String(idCupon) && r.accion === 'Crear');

    expect(alta?.valorNuevo).not.toHaveProperty('Categoria');
  });
});

describe('consulta de la bitácora (E7-H02, RF-09)', () => {
  it('filtra por módulo y entidad: el alta de un cupón con quién la hizo y el valor nuevo', async () => {
    const { codigo, idCupon } = await crearCupon(app, admin.token, { limiteUsosTotal: 2 });

    const { datos } = await bitacora('modulo=Cupones&entidad=Cupon&tamano=100');

    expect(datos.every((r) => r.modulo === 'Cupones' && r.entidad === 'Cupon')).toBe(true);
    expect(datos).toContainEqual(
      expect.objectContaining({
        idEntidad: String(idCupon),
        accion: 'Crear',
        valorAnterior: null,
        valorNuevo: expect.objectContaining({ Codigo: codigo }) as unknown,
        usuario: expect.objectContaining({ idUsuario: admin.idUsuario }) as unknown,
      }),
    );
  });

  it('el rango usa días de Guatemala: hoy incluye el alta; un día pasado sin cambios, nada', async () => {
    const { idCupon } = await crearCupon(app, admin.token, { limiteUsosTotal: 2 });
    const hoy = await hoyEnGuatemala();

    const deHoy = await bitacora(
      `modulo=Cupones&entidad=Cupon&desde=${hoy}&hasta=${hoy}&tamano=100`,
    );
    const pasado = await bitacora('modulo=Cupones&desde=2001-01-01&hasta=2001-01-31');

    expect(deHoy.datos.map((r) => r.idEntidad)).toContain(String(idCupon));
    expect(pasado.paginacion.total).toBe(0);
  });

  it('valida los filtros (400) y es solo para el Admin (403)', async () => {
    const modulo = await request(app)
      .get('/api/v1/bitacora?modulo=Nada')
      .set(comoCliente(admin.token));
    const rango = await request(app)
      .get('/api/v1/bitacora?desde=2026-02-01&hasta=2026-01-01')
      .set(comoCliente(admin.token));
    const operador = await request(app).get('/api/v1/bitacora').set(comoCliente(tokenOperador));

    expect([modulo.status, rango.status, operador.status]).toEqual([400, 400, 403]);
  });
});
