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

  it('pagina en el servidor: páginas distintas y el total del filtro, lo más reciente primero', async () => {
    await crearCupon(app, admin.token, { limiteUsosTotal: 2 });
    await crearCupon(app, admin.token, { limiteUsosTotal: 2 });

    const primera = await bitacora('modulo=Cupones&tamano=1&pagina=1');
    const segunda = await bitacora('modulo=Cupones&tamano=1&pagina=2');

    expect(primera.datos).toHaveLength(1);
    expect(primera.paginacion).toMatchObject({ pagina: 1, tamano: 1 });
    expect(primera.paginacion.total).toBeGreaterThanOrEqual(2);
    expect(primera.datos[0]?.idBitacora).not.toBe(segunda.datos[0]?.idBitacora);
    expect(Date.parse(primera.datos[0]?.fecha ?? '')).toBeGreaterThanOrEqual(
      Date.parse(segunda.datos[0]?.fecha ?? ''),
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
