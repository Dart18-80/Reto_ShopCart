import request, { type Response } from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion, registrar } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { conToken } from '../catalogo/apoyo-catalogo.js';
import { leerBitacora } from '../datos-de-prueba.js';

usarBaseDePruebas();

// Grupo secuencial: cambian parámetros y tarifas globales; cada prueba deja los valores como estaban.

const app = crearApp(dependenciasDePrueba());
const ID_PARAMETROS = 1;
const ID_INEXISTENTE = 2_147_483_647;

const configuracionSchema = z.strictObject({
  diasGarantiaPrecio: z.number(),
  minutosReserva: z.number(),
  horasCarritoAbandonado: z.number(),
  diasExpiracionCarritoInvitado: z.number(),
  umbralUltimasUnidades: z.number(),
  montoEnvioGratis: z.string().nullable(),
  maxIntentosPagoRechazados: z.number(),
  diasPlazoDevolucion: z.number(),
  maxLineasCarrito: z.number(),
  fechaActualizacion: z.string(),
});
const metodoSchema = z.strictObject({
  idMetodoEnvio: z.number(),
  codigo: z.string(),
  nombre: z.string(),
  costo: z.string(),
  diasMin: z.number(),
  diasMax: z.number(),
  activo: z.boolean(),
});
const metodoActivoSchema = z.looseObject({
  idMetodoEnvio: z.number(),
  nombre: z.string(),
  tarifa: z.string(),
  diasMin: z.number(),
  diasMax: z.number(),
});
const metodosSchema = z.object({
  metodos: z.array(
    z.looseObject({ idMetodoEnvio: z.number(), codigo: z.string(), costo: z.string() }),
  ),
  envioGratis: z.looseObject({}).nullable(),
});

let admin: { token: string; idUsuario: number };

beforeAll(async () => {
  const sesion = leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!'));
  admin = { token: sesion.accessToken, idUsuario: sesion.usuario.idUsuario };
});

const configuracion = async () =>
  leerDatos(
    await request(app).get('/api/v1/admin/configuracion').set(conToken(admin.token)),
    configuracionSchema,
  );

const cambiarConfiguracion = (cambios: Record<string, unknown>) =>
  request(app).patch('/api/v1/admin/configuracion').set(conToken(admin.token)).send(cambios);

const requestIdDe = (respuesta: Response): string => String(respuesta.headers['x-request-id']);

async function estandar() {
  const lista = leerDatos(await request(app).get('/api/v1/envios/metodos'), metodosSchema);
  const metodo = lista.metodos.find((m) => m.codigo === 'Estandar');
  if (metodo === undefined) throw new Error('Falta el método Estandar de la semilla');
  return metodo;
}

const actualizarMetodo = (idMetodoEnvio: number, cuerpo: Record<string, unknown>) =>
  request(app)
    .put(`/api/v1/admin/envios/metodos/${String(idMetodoEnvio)}`)
    .set(conToken(admin.token))
    .send(cuerpo);

describe('parámetros del sistema (E4-H06, A-14, RF-09)', () => {
  it('el Admin los cambia y el cambio queda en la bitácora con su usuario y su petición', async () => {
    const antes = await configuracion();
    try {
      const respuesta = await cambiarConfiguracion({
        umbralUltimasUnidades: 7,
        montoEnvioGratis: '750',
      });

      expect(leerDatos(respuesta, configuracionSchema)).toMatchObject({
        umbralUltimasUnidades: 7,
        montoEnvioGratis: '750.00',
        diasGarantiaPrecio: antes.diasGarantiaPrecio,
      });
      const [fila] = await leerBitacora('ParametroSistema', ID_PARAMETROS);
      expect(fila).toMatchObject({
        Modulo: 'Configuracion',
        Accion: 'Modificar',
        IDUsuario: admin.idUsuario,
        RequestId: expect.stringMatching(new RegExp(requestIdDe(respuesta), 'i')) as unknown,
      });
      expect(JSON.parse(fila?.ValorNuevo ?? '{}')).toMatchObject({
        UmbralUltimasUnidades: 7,
        MontoEnvioGratis: '750.00',
      });
    } finally {
      await cambiarConfiguracion({
        umbralUltimasUnidades: antes.umbralUltimasUnidades,
        montoEnvioGratis: antes.montoEnvioGratis,
      });
    }
  });

  it('montoEnvioGratis en null deja la tienda sin envío gratis', async () => {
    const antes = await configuracion();
    try {
      await cambiarConfiguracion({ montoEnvioGratis: null });

      const lista = leerDatos(await request(app).get('/api/v1/envios/metodos'), metodosSchema);
      expect(lista.envioGratis).toBeNull();
    } finally {
      await cambiarConfiguracion({ montoEnvioGratis: antes.montoEnvioGratis });
    }
  });

  it.each([
    { diasGarantiaPrecio: 0 },
    { minutosReserva: 61 },
    { maxLineasCarrito: 201 },
    { montoEnvioGratis: '0' },
    { desconocido: 1 },
    {},
  ])('rechaza %o con 400', async (cambios) => {
    const respuesta = await cambiarConfiguracion(cambios);

    expect(respuesta.status).toBe(400);
  });

  it('el Operador y el Cliente reciben 403', async () => {
    const operador = leerSesion(await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'));
    const cliente = leerSesion(await registrar(app));

    const respuestas = await Promise.all(
      [operador.accessToken, cliente.accessToken].map((token) =>
        request(app).get('/api/v1/admin/configuracion').set(conToken(token)),
      ),
    );

    expect(respuestas.map((r) => r.status)).toEqual([403, 403]);
  });
});

describe('tarifas de envío (E4-H06, N-04, RF-09)', () => {
  it('el Admin cambia una tarifa, los métodos la reflejan y queda en la bitácora con su contexto', async () => {
    const { idMetodoEnvio, costo } = await estandar();
    const original = leerDatos(
      await actualizarMetodo(idMetodoEnvio, {
        nombre: 'Estándar',
        costo,
        diasMin: 3,
        diasMax: 5,
        activo: true,
      }),
      metodoSchema,
    );
    try {
      const respuesta = await actualizarMetodo(idMetodoEnvio, {
        nombre: 'Estándar',
        costo: '40.5',
        diasMin: 2,
        diasMax: 4,
        activo: true,
      });

      expect(leerDatos(respuesta, metodoSchema)).toMatchObject({ costo: '40.50', diasMin: 2 });
      expect((await estandar()).costo).toBe('40.50');
      const [fila] = await leerBitacora('MetodoEnvio', idMetodoEnvio);
      expect(fila).toMatchObject({
        Modulo: 'Envios',
        Accion: 'Modificar',
        IDUsuario: admin.idUsuario,
        RequestId: expect.stringMatching(new RegExp(requestIdDe(respuesta), 'i')) as unknown,
      });
    } finally {
      await actualizarMetodo(idMetodoEnvio, {
        nombre: original.nombre,
        costo: original.costo,
        diasMin: original.diasMin,
        diasMax: original.diasMax,
        activo: original.activo,
      });
    }
  });

  it('N-04: dos desactivaciones simultáneas de los dos últimos métodos activos: una pasa y la otra recibe 409', async () => {
    const activos = leerDatos(
      await request(app).get('/api/v1/envios/metodos'),
      z.object({ metodos: z.array(metodoActivoSchema) }),
    ).metodos;
    const cuerpo = (m: z.infer<typeof metodoActivoSchema>, activo: boolean) => ({
      nombre: m.nombre,
      costo: m.tarifa,
      diasMin: m.diasMin,
      diasMax: m.diasMax,
      activo,
    });
    try {
      const respuestas = await Promise.all(
        activos.map((m) => actualizarMetodo(m.idMetodoEnvio, cuerpo(m, false))),
      );
      const quedan = leerDatos(await request(app).get('/api/v1/envios/metodos'), metodosSchema);

      expect(activos).toHaveLength(2);
      expect(respuestas.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(respuestas.find((r) => r.status === 409)?.body).toMatchObject({
        error: { codigo: 'METODO_ENVIO_ULTIMO_ACTIVO' },
      });
      expect(quedan.metodos).toHaveLength(1);
    } finally {
      for (const m of activos) await actualizarMetodo(m.idMetodoEnvio, cuerpo(m, true));
    }
  });

  it('un método inexistente responde 404 y días al revés 400', async () => {
    const { idMetodoEnvio } = await estandar();
    const cuerpo = { nombre: 'X', costo: '1', diasMin: 2, diasMax: 5, activo: true };

    const inexistente = await actualizarMetodo(ID_INEXISTENTE, cuerpo);
    const alReves = await actualizarMetodo(idMetodoEnvio, { ...cuerpo, diasMin: 6 });

    expect(inexistente.status).toBe(404);
    expect(leerError(alReves).codigo).toBe('VALIDACION_FALLIDA');
  });
});
