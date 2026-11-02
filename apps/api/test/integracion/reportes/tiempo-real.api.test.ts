import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { Express } from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../../../src/app.js';
import {
  crearDifusorDeVersiones,
  MAX_CONEXIONES_POR_USUARIO,
} from '../../../src/modules/reportes/index.js';
import { crearAvisosRedis } from '../../../src/shared/adapters/avisos-redis.js';
import { crearCacheRedis } from '../../../src/shared/adapters/cache-redis.js';
import { crearClienteRedis } from '../../../src/shared/adapters/redis.js';
import { cargarConfiguracion } from '../../../src/shared/config/index.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { leerDatos } from '../../unit/respuestas.js';
import { iniciarSesion, leerSesion, registrar } from '../auth/apoyo-auth.js';
import { comoCliente } from '../carrito/apoyo-carrito.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { metodoEnvio } from '../checkout/apoyo-checkout.js';
import { pedidoPagado } from '../pedidos/apoyo-pedidos.js';

// E9-H02 (A-25): dos "réplicas" (dos apps) con la caché y el canal de avisos en el mismo Redis real, cada una con
// su difusor y su propia conexión de suscripción.

usarBaseDePruebas();

const RUTA = '/api/v1/admin/reportes/eventos';
const ESPERA_EVENTO_MS = 10_000;
// El latido revisa el token y la sesión de cada stream; aquí más seguido que en producción.
const LATIDO_MS = 200;
const silencioso = pino({ level: 'silent' });
const config = cargarConfiguracion(process.env);

function replica() {
  const redis = crearClienteRedis(config.redis);
  const cache = crearCacheRedis(redis, silencioso);
  const avisos = crearAvisosRedis(redis, silencioso);
  const difusor = crearDifusorDeVersiones({
    cache,
    avisos,
    logger: silencioso,
    latidoMs: LATIDO_MS,
  });
  const app = crearApp(dependenciasDePrueba({ cache, avisos, difusorEventos: difusor }));
  return { redis, avisos, difusor, app };
}

const replica1 = replica();
const replica2 = replica();
let servidor2: Server;
let url2 = '';
let tokenAdmin = '';

async function escuchar(app: Express): Promise<Server> {
  const servidor = app.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  return servidor;
}

beforeAll(async () => {
  await Promise.all([replica1.redis.connect(), replica2.redis.connect()]);
  servidor2 = await escuchar(replica2.app);
  const direccion = servidor2.address();
  if (direccion === null || typeof direccion === 'string') throw new Error('Sin puerto');
  url2 = `http://127.0.0.1:${String(direccion.port)}`;
  tokenAdmin = leerSesion(
    await iniciarSesion(replica2.app, 'admin@shopcart.gt', 'Admin2026!'),
  ).accessToken;
});

afterAll(async () => {
  replica1.difusor.cerrarTodas();
  replica2.difusor.cerrarTodas();
  servidor2.close();
  await Promise.all([replica1.avisos.cerrar(), replica2.avisos.cerrar()]);
  await Promise.all([replica1.redis.quit(), replica2.redis.quit()]);
});

/** Abre el stream y devuelve sus eventos a medida que llegan. */
async function abrir(token: string) {
  const controlador = new AbortController();
  const respuesta = await fetch(`${url2}${RUTA}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controlador.signal,
  });
  const recibido: string[] = [];
  const terminado = (async () => {
    if (respuesta.body === null) return;
    const decodificador = new TextDecoder();
    try {
      for await (const parte of respuesta.body) recibido.push(decodificador.decode(parte));
    } catch {
      // Se abortó al cerrar la prueba.
    }
  })();
  let cerrado = false;
  void terminado.then(() => {
    cerrado = true;
  });
  return {
    respuesta,
    cerradoPorElServidor: () => cerrado,
    eventos: () =>
      recibido
        .join('')
        .split('\n\n')
        .filter((e) => e.startsWith('id:')),
    cerrar: async () => {
      controlador.abort();
      await terminado;
    },
  };
}

async function hasta(condicion: () => boolean): Promise<void> {
  const fin = Date.now() + ESPERA_EVENTO_MS;
  while (!condicion()) {
    if (Date.now() > fin) throw new Error('El evento no llegó a tiempo');
    await new Promise((resolver) => setTimeout(resolver, 50));
  }
}

describe('dashboard en tiempo real (E9-H02, A-25)', () => {
  it('si se revoca la sesión del Admin (cambia su rol), su stream se cierra en el siguiente latido (A-07)', async () => {
    const correo = `admin-${randomUUID().slice(0, 8)}@ejemplo.gt`;
    const creado = await request(replica2.app)
      .post('/api/v1/usuarios')
      .set(comoCliente(tokenAdmin))
      .send({
        correo,
        contrasena: 'OtroAdmin2026!',
        nombre: 'Admin Revocado',
        rol: 'Administrador',
      });
    const { idUsuario } = leerDatos(creado, z.object({ idUsuario: z.number() }));
    const token = leerSesion(
      await iniciarSesion(replica2.app, correo, 'OtroAdmin2026!'),
    ).accessToken;
    const stream = await abrir(token);
    await hasta(() => stream.eventos().length === 1);

    await request(replica2.app)
      .patch(`/api/v1/usuarios/${String(idUsuario)}`)
      .set(comoCliente(tokenAdmin))
      .send({ rol: 'Operador' });
    await hasta(() => stream.cerradoPorElServidor());

    expect(stream.cerradoPorElServidor()).toBe(true);
  });

  it('un pedido creado en una réplica llega como evento a un cliente conectado a la otra', async () => {
    const stream = await abrir(tokenAdmin);
    await hasta(() => stream.eventos().length === 1);

    await pedidoPagado(replica1.app, await metodoEnvio(replica1.app));
    await hasta(() => stream.eventos().some((e) => e.includes('"dominio":"ventas"')));
    await stream.cerrar();

    expect(stream.respuesta.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(stream.eventos()[0]).toMatch(/^id: ventas\d+\.carritos\d+\nevent: versiones\n/);
    const deVentas = stream.eventos().find((e) => e.includes('"dominio":"ventas"'));
    expect(deVentas).toMatch(
      /^id: ventas\d+\.carritos\d+\nevent: cambio\ndata: \{"dominio":"ventas","version":\d+\}/,
    );
  });

  it('sin token responde 401; un Operador o un Cliente, 403', async () => {
    const operador = leerSesion(
      await iniciarSesion(replica2.app, 'operador@shopcart.gt', 'Operador2026!'),
    ).accessToken;
    const cliente = leerSesion(await registrar(replica2.app)).accessToken;

    const respuestas = await Promise.all([
      fetch(`${url2}${RUTA}`),
      fetch(`${url2}${RUTA}`, { headers: { Authorization: `Bearer ${operador}` } }),
      fetch(`${url2}${RUTA}`, { headers: { Authorization: `Bearer ${cliente}` } }),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([401, 403, 403]);
  });

  it(`más de ${String(MAX_CONEXIONES_POR_USUARIO)} streams del mismo Admin en la réplica responde 429`, async () => {
    const abiertos = [];
    for (let i = 0; i < MAX_CONEXIONES_POR_USUARIO; i++) abiertos.push(await abrir(tokenAdmin));

    const sobrante = await fetch(`${url2}${RUTA}`, {
      headers: { Authorization: `Bearer ${tokenAdmin}` },
    });
    await Promise.all(abiertos.map((s) => s.cerrar()));

    expect(sobrante.status).toBe(429);
    expect(await sobrante.json()).toMatchObject({ error: { codigo: 'CONEXIONES_MAXIMAS' } });
  });
});
