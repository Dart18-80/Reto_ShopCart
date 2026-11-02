import { EventEmitter, once } from 'node:events';
import { createServer, request as peticionHttp, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { registrarApagadoOrdenado } from '../../src/apagado.js';
import { crearLogger } from '../../src/shared/observability/logger.js';

const NIVEL_FATAL = 60;
const ESPERA_PETICION_LENTA_MS = 150;

const lineaSchema = z.looseObject({ level: z.number(), msg: z.string() });

let servidor: Server | undefined;

afterEach(() => {
  servidor?.closeAllConnections();
  servidor?.close();
});

function loggerEnMemoria() {
  const lineas: z.infer<typeof lineaSchema>[] = [];
  const destino = new Writable({
    write(fragmento: Buffer, _codificacion, listo) {
      lineas.push(lineaSchema.parse(JSON.parse(fragmento.toString())));
      listo();
    },
  });
  return { logger: crearLogger({ destino }), lineas };
}

/** Servidor real con una ruta que tarda: simula una petición en curso durante el apagado. */
async function iniciarServidor(): Promise<number> {
  const nuevo = createServer((_req, res) => {
    setTimeout(() => res.end('terminada'), ESPERA_PETICION_LENTA_MS);
  });
  servidor = nuevo;
  await new Promise<void>((listo) => nuevo.listen(0, '127.0.0.1', listo));
  return (nuevo.address() as AddressInfo).port;
}

/** Espera a que el servidor reciba la petición: sin esto, la señal podría llegar antes que la conexión. */
async function peticionRecibida(): Promise<void> {
  if (servidor === undefined) throw new Error('Inicia el servidor antes de pedir');
  await once(servidor, 'request');
}

function pedir(puerto: number): Promise<string> {
  return new Promise((resolver, rechazar) => {
    peticionHttp({ host: '127.0.0.1', port: puerto, agent: false }, (respuesta) => {
      let cuerpo = '';
      respuesta.on('data', (parte: Buffer) => (cuerpo += parte.toString()));
      respuesta.on('end', () => {
        resolver(cuerpo);
      });
    })
      .on('error', rechazar)
      .end();
  });
}

function preparar({
  esperaMaximaMs = 2_000,
  cierres = [() => Promise.resolve()],
  alIniciar = [] as (() => void)[],
} = {}) {
  const proceso = new EventEmitter();
  const { logger, lineas } = loggerEnMemoria();
  const recursos = cierres.map((cierre) => vi.fn(cierre));
  let resolverSalida: (codigo: number) => void = () => undefined;
  const salida = new Promise<number>((resolver) => (resolverSalida = resolver));
  const salir = vi.fn((codigo: number) => {
    resolverSalida(codigo);
  });

  if (servidor === undefined) throw new Error('Inicia el servidor antes de preparar el apagado');
  registrarApagadoOrdenado({
    proceso,
    servidor,
    recursos,
    logger,
    salir,
    esperaMaximaMs,
    alIniciar,
  });
  return { proceso, recursos, salir, salida, lineas };
}

/** Un servidor con una respuesta que no termina sola (como un stream SSE) y cómo cerrarla desde fuera. */
async function iniciarServidorConStream() {
  const abiertas = new Set<ServerResponse>();
  const nuevo = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(': abierto\n\n');
    abiertas.add(res);
  });
  servidor = nuevo;
  await new Promise<void>((listo) => nuevo.listen(0, '127.0.0.1', listo));
  return {
    puerto: (nuevo.address() as AddressInfo).port,
    cerrarStreams: vi.fn(() => {
      for (const res of abiertas) res.end();
    }),
  };
}

describe('apagado ordenado (E0-H04)', () => {
  it('E9-H02: antes de cerrar el servidor cierra los streams abiertos; si no, el apagado esperaría hasta forzar la salida', async () => {
    const { puerto, cerrarStreams } = await iniciarServidorConStream();
    const { proceso, salida } = preparar({ esperaMaximaMs: 1_000, alIniciar: [cerrarStreams] });
    const recibida = peticionRecibida();
    const stream = pedir(puerto);
    await recibida;

    proceso.emit('SIGTERM', 'SIGTERM');

    await expect(stream).resolves.toContain(': abierto');
    expect(await salida).toBe(0);
    expect(cerrarStreams).toHaveBeenCalledTimes(1);
  });

  it('con SIGTERM termina las peticiones en curso, cierra los recursos y sale con 0', async () => {
    const puerto = await iniciarServidor();
    const { proceso, recursos, salida } = preparar();
    const recibida = peticionRecibida();
    const enCurso = pedir(puerto);
    await recibida;

    proceso.emit('SIGTERM', 'SIGTERM');

    await expect(enCurso).resolves.toBe('terminada');
    expect(await salida).toBe(0);
    for (const recurso of recursos) expect(recurso).toHaveBeenCalledTimes(1);
  });

  it('durante el apagado ya no acepta conexiones nuevas', async () => {
    const puerto = await iniciarServidor();
    const { proceso } = preparar();
    const recibida = peticionRecibida();
    const enCurso = pedir(puerto);
    await recibida;

    proceso.emit('SIGTERM', 'SIGTERM');

    await expect(pedir(puerto)).rejects.toThrow(/ECONNREFUSED/);
    await enCurso;
  });

  it('si un recurso no cierra limpio lo registra y sale igual con 0', async () => {
    await iniciarServidor();
    const { proceso, salida, lineas } = preparar({
      cierres: [() => Promise.reject(new Error('Redis no responde')), () => Promise.resolve()],
    });

    proceso.emit('SIGINT', 'SIGINT');

    expect(await salida).toBe(0);
    expect(lineas.map((linea) => linea.msg)).toContain('Un recurso no se cerró limpiamente');
  });

  it('si una petición no termina a tiempo fuerza la salida con 1', async () => {
    const puerto = await iniciarServidor();
    const { proceso, salida } = preparar({ esperaMaximaMs: 50 });
    const recibida = peticionRecibida();
    const enCurso = pedir(puerto).catch(() => undefined);
    await recibida;

    proceso.emit('SIGTERM', 'SIGTERM');

    expect(await salida).toBe(1);
    await enCurso;
  });

  it('un recurso que lanza al cerrar no impide cerrar los demás ni salir', async () => {
    await iniciarServidor();
    const { proceso, recursos, salida } = preparar({
      cierres: [
        () => {
          throw new Error('cierre que lanza de inmediato');
        },
        () => Promise.resolve(),
      ],
    });

    proceso.emit('SIGTERM', 'SIGTERM');

    expect(await salida).toBe(0);
    expect(recursos[1]).toHaveBeenCalledTimes(1);
  });

  it('una segunda señal no repite el apagado', async () => {
    await iniciarServidor();
    const { proceso, recursos, salida } = preparar();

    proceso.emit('SIGTERM', 'SIGTERM');
    proceso.emit('SIGINT', 'SIGINT');

    await salida;
    expect(recursos[0]).toHaveBeenCalledTimes(1);
  });

  it('un error no capturado se registra como fatal y apaga ordenadamente con 1', async () => {
    const puerto = await iniciarServidor();
    const { proceso, recursos, salida, lineas } = preparar();
    const recibida = peticionRecibida();
    const enCurso = pedir(puerto);
    await recibida;

    proceso.emit('uncaughtException', new Error('fallo inesperado'));

    await expect(enCurso).resolves.toBe('terminada');
    expect(await salida).toBe(1);
    expect(recursos[0]).toHaveBeenCalledTimes(1);
    expect(lineas.find((linea) => linea.level === NIVEL_FATAL)?.msg).toBe('Error no capturado');
  });

  it('un error fatal durante un apagado por SIGTERM cambia el código de salida a 1', async () => {
    const puerto = await iniciarServidor();
    const { proceso, salida } = preparar();
    const recibida = peticionRecibida();
    const enCurso = pedir(puerto);
    await recibida;

    proceso.emit('SIGTERM', 'SIGTERM');
    proceso.emit('uncaughtException', new Error('fallo mientras se apagaba'));

    expect(await salida).toBe(1);
    await enCurso;
  });

  it('una promesa rechazada sin manejar se registra como fatal y apaga con 1', async () => {
    await iniciarServidor();
    const { proceso, salida, lineas } = preparar();

    proceso.emit('unhandledRejection', new Error('rechazo olvidado'));

    expect(await salida).toBe(1);
    expect(lineas.find((linea) => linea.level === NIVEL_FATAL)?.msg).toBe(
      'Promesa rechazada sin manejar',
    );
  });
});
