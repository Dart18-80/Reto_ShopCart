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
import { crearVariante } from '../datos-de-prueba.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const ID_INEXISTENTE = 2_147_483_647;

const movimientoSchema = z.object({
  idMovimientoKardex: z.number(),
  idVariante: z.number(),
  tipo: z.string(),
  signo: z.number(),
  cantidad: z.number(),
  existenciaAnterior: z.number(),
  existenciaResultante: z.number(),
  motivo: z.string(),
  referencia: z.string().nullable(),
  usuario: z.object({ idUsuario: z.number(), nombre: z.string() }),
  fecha: z.string(),
});
const existenciaSchema = z.looseObject({
  idVariante: z.number(),
  existenciaFisica: z.number(),
  reservado: z.number(),
  disponible: z.number(),
});
const listado = <T extends z.ZodType>(schema: T) =>
  z.object({ datos: z.array(schema), paginacion: z.looseObject({ total: z.number() }) });

let operador: { token: string; idUsuario: number };

beforeAll(async () => {
  const sesion = leerSesion(await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'));
  operador = { token: sesion.accessToken, idUsuario: sesion.usuario.idUsuario };
});

const conOperador = () => ({ Authorization: `Bearer ${operador.token}` });
const nuevaVariante = async () => (await crearVariante()).IDVariante;

const entrada = (idVariante: number, cuerpo: Record<string, unknown> = {}) =>
  request(app)
    .post('/api/v1/inventario/entradas')
    .set(conOperador())
    .send({ idVariante, cantidad: 10, motivo: 'Compra a proveedor', ...cuerpo });

const ajuste = (idVariante: number, cantidad: number, cuerpo: Record<string, unknown> = {}) =>
  request(app)
    .post('/api/v1/inventario/ajustes')
    .set(conOperador())
    .send({ idVariante, cantidad, motivo: 'Conteo físico', ...cuerpo });

async function existencia(idVariante: number) {
  const respuesta = await request(app)
    .get(`/api/v1/inventario/existencias?variante=${String(idVariante)}`)
    .set(conOperador());
  const [fila] = listado(existenciaSchema).parse(respuesta.body).datos;
  return fila;
}

describe('entradas y ajustes (E3-H06, N-07, N-16)', () => {
  it('una entrada suma existencia y deja el movimiento con usuario, fecha, motivo, cantidad y saldos', async () => {
    const idVariante = await nuevaVariante();

    const respuesta = await entrada(idVariante, { referencia: 'FAC-001' });

    expect(respuesta.status).toBe(201);
    expect(leerDatos(respuesta, movimientoSchema)).toMatchObject({
      tipo: 'EntradaCompra',
      signo: 1,
      cantidad: 10,
      existenciaAnterior: 0,
      existenciaResultante: 10,
      motivo: 'Compra a proveedor',
      referencia: 'FAC-001',
      usuario: { idUsuario: operador.idUsuario },
    });
    expect(await existencia(idVariante)).toMatchObject({ existenciaFisica: 10, disponible: 10 });
  });

  it.each([
    ['sin motivo', {}],
    ['con motivo vacío', { motivo: '' }],
    ['con motivo de solo espacios', { motivo: '   ' }],
  ])(
    'CA: un ajuste %s responde 400 MOTIVO_REQUERIDO, igual que una entrada',
    async (_caso, cambio) => {
      const idVariante = await nuevaVariante();
      // El cuerpo solo lleva motivo si el caso lo trae.
      const cuerpo = { idVariante, cantidad: 2, ...cambio };

      const respuestas = [
        await request(app).post('/api/v1/inventario/ajustes').set(conOperador()).send(cuerpo),
        await request(app).post('/api/v1/inventario/entradas').set(conOperador()).send(cuerpo),
      ];

      for (const respuesta of respuestas) {
        expect(respuesta.status).toBe(400);
        expect(leerError(respuesta).codigo).toBe('MOTIVO_REQUERIDO');
      }
    },
  );

  it('CA: un ajuste que deja la existencia negativa responde 422 AJUSTE_DEJA_NEGATIVO', async () => {
    const idVariante = await nuevaVariante();
    await entrada(idVariante, { cantidad: 3 });

    const respuesta = await ajuste(idVariante, -4);

    expect(respuesta.status).toBe(422);
    expect(leerError(respuesta).codigo).toBe('AJUSTE_DEJA_NEGATIVO');
  });

  it('CA: un ajuste que deja la física por debajo de lo reservado responde 422 con el máximo ajustable', async () => {
    const idVariante = await nuevaVariante();
    await entrada(idVariante, { cantidad: 10 });
    await ejecutarSP('SP_Pruebas_CrearReserva', {
      IDVariante: { tipo: sql.Int, valor: idVariante },
      Cantidad: { tipo: sql.Int, valor: 7 },
      MinutosParaVencer: { tipo: sql.Int, valor: 15 },
    });

    const excesivo = await ajuste(idVariante, -5);
    const justo = await ajuste(idVariante, -3);

    expect(excesivo.status).toBe(422);
    expect(leerError(excesivo)).toMatchObject({
      codigo: 'AJUSTE_BAJO_RESERVADO',
      detalles: { maximoAjustable: 3 },
    });
    expect(leerDatos(justo, movimientoSchema)).toMatchObject({
      tipo: 'AjusteNegativo',
      signo: -1,
      cantidad: 3,
      existenciaResultante: 7,
    });
  });

  it('un ajuste positivo es AjustePositivo; una cantidad de 0 o una variante inexistente se rechazan', async () => {
    const idVariante = await nuevaVariante();

    const positivo = await ajuste(idVariante, 4);
    const cero = await ajuste(idVariante, 0);
    const inexistente = await ajuste(ID_INEXISTENTE, 1);

    expect(leerDatos(positivo, movimientoSchema)).toMatchObject({
      tipo: 'AjustePositivo',
      existenciaResultante: 4,
    });
    expect(cero.status).toBe(400);
    expect(inexistente.status).toBe(404);
  });

  it('CA: tras movimientos simultáneos, el saldo cuadra con el kardex y la conciliación no muestra la variante', async () => {
    const idVariante = await nuevaVariante();
    await entrada(idVariante, { cantidad: 20 });

    const respuestas = await Promise.all(
      [5, -3, 2, -4, 1, -2, 3, -1].map((cantidad) => ajuste(idVariante, cantidad)),
    );

    expect(respuestas.every((r) => r.status === 201)).toBe(true);
    expect(await existencia(idVariante)).toMatchObject({ existenciaFisica: 21 });
    const conciliacion = await request(app)
      .get('/api/v1/inventario/conciliacion')
      .set(conOperador());
    const descuadradas = z
      .object({ datos: z.array(z.looseObject({ idVariante: z.number() })) })
      .parse(conciliacion.body).datos;
    expect(descuadradas.map((fila) => fila.idVariante)).not.toContain(idVariante);
  });
});

describe('consultas de inventario (E3-H06)', () => {
  it('el kardex de una variante va paginado, del movimiento más reciente al más antiguo', async () => {
    const idVariante = await nuevaVariante();
    await entrada(idVariante, { cantidad: 5 });
    await ajuste(idVariante, -2);
    await ajuste(idVariante, 1);

    const respuesta = await request(app)
      .get(`/api/v1/inventario/kardex?variante=${String(idVariante)}&tamano=2`)
      .set(conOperador());

    const kardex = listado(movimientoSchema).parse(respuesta.body);
    expect(kardex.datos.map((m) => [m.tipo, m.existenciaResultante])).toEqual([
      ['AjustePositivo', 4],
      ['AjusteNegativo', 3],
    ]);
    expect(kardex.paginacion.total).toBe(3);
  });

  it('el kardex sin variante responde 400 y de una variante inexistente 404', async () => {
    const sinVariante = await request(app).get('/api/v1/inventario/kardex').set(conOperador());
    const inexistente = await request(app)
      .get(`/api/v1/inventario/kardex?variante=${String(ID_INEXISTENTE)}`)
      .set(conOperador());

    expect([sinVariante.status, inexistente.status]).toEqual([400, 404]);
  });

  it('existencias muestra física, reservada y disponible', async () => {
    const idVariante = await nuevaVariante();
    await entrada(idVariante, { cantidad: 8 });
    await ejecutarSP('SP_Pruebas_CrearReserva', {
      IDVariante: { tipo: sql.Int, valor: idVariante },
      Cantidad: { tipo: sql.Int, valor: 3 },
      MinutosParaVencer: { tipo: sql.Int, valor: 15 },
    });

    expect(await existencia(idVariante)).toMatchObject({
      existenciaFisica: 8,
      reservado: 3,
      disponible: 5,
    });
  });

  it('bodega suma a la física las unidades pagadas por despachar (N-07)', async () => {
    const idVariante = await nuevaVariante();
    await entrada(idVariante, { cantidad: 6 });

    const respuesta = await request(app)
      .get(`/api/v1/inventario/bodega?variante=${String(idVariante)}`)
      .set(conOperador());

    const [fila] = listado(z.looseObject({ existenciaBodega: z.number() })).parse(
      respuesta.body,
    ).datos;
    expect(fila).toMatchObject({
      existenciaFisica: 6,
      unidadesPorDespachar: 0,
      existenciaBodega: 6,
    });
  });
});

describe('roles en inventario (RF-01)', () => {
  it('el Admin también opera el inventario', async () => {
    const admin = leerSesion(
      await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!'),
    ).accessToken;
    const idVariante = await nuevaVariante();

    const respuesta = await request(app)
      .post('/api/v1/inventario/entradas')
      .set({ Authorization: `Bearer ${admin}` })
      .send({ idVariante, cantidad: 1, motivo: 'Inventario inicial' });

    expect(respuesta.status).toBe(201);
  });

  it('un Cliente recibe 403 en cada ruta de inventario y sin token 401', async () => {
    const cliente = leerSesion(await registrar(app)).accessToken;
    const idVariante = await nuevaVariante();
    const intentos = (cabeceras: Record<string, string>) => [
      request(app)
        .post('/api/v1/inventario/entradas')
        .set(cabeceras)
        .send({ idVariante, cantidad: 1, motivo: 'X' }),
      request(app)
        .post('/api/v1/inventario/ajustes')
        .set(cabeceras)
        .send({ idVariante, cantidad: 1, motivo: 'X' }),
      request(app)
        .get(`/api/v1/inventario/kardex?variante=${String(idVariante)}`)
        .set(cabeceras),
      request(app).get('/api/v1/inventario/existencias').set(cabeceras),
      request(app).get('/api/v1/inventario/conciliacion').set(cabeceras),
      request(app).get('/api/v1/inventario/bodega').set(cabeceras),
    ];

    for (const respuesta of await Promise.all(intentos({ Authorization: `Bearer ${cliente}` }))) {
      expect(respuesta.status).toBe(403);
    }
    for (const respuesta of await Promise.all(intentos({}))) expect(respuesta.status).toBe(401);
  });
});
