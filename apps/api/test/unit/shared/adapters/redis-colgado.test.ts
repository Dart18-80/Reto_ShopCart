import { createServer, type Server, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';
import type { Redis } from 'ioredis';
import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearLimitadorRedis } from '../../../../src/shared/adapters/limitador-redis.js';
import { crearClienteRedis } from '../../../../src/shared/adapters/redis.js';
import { crearVersionesSesionRedis } from '../../../../src/shared/adapters/versiones-sesion-redis.js';

const ESPERA_MAXIMA_MS = 1500;
const COMANDO_RESP = /\*\d+\r\n\$\d+\r\n([A-Za-z]+)\r\n/g;
const INFO_LISTO = 'loading:0\r\n';
const RESPUESTAS_DE_ARRANQUE: Record<string, string> = {
  HELLO: '*2\r\n$6\r\nserver\r\n$5\r\nredis\r\n',
  CLIENT: '+OK\r\n',
  INFO: `$${String(INFO_LISTO.length)}\r\n${INFO_LISTO}\r\n`,
};

/**
 * Redis que acepta la conexión y contesta el arranque de ioredis (HELLO con AUTH, CLIENT SETINFO e
 * INFO), pero nunca responde otro comando: el cliente queda en 'ready' con la conexión abierta, como
 * un Redis bloqueado.
 */
function responderSoloElArranque(socket: Socket): void {
  socket.on('data', (trozo) => {
    for (const [, comando = ''] of trozo.toString().matchAll(COMANDO_RESP)) {
      const respuesta = RESPUESTAS_DE_ARRANQUE[comando.toUpperCase()];
      if (respuesta !== undefined) socket.write(respuesta);
    }
  });
}

let servidor: Server;
let conexiones: Socket[];
let cliente: Redis;

beforeEach(async () => {
  conexiones = [];
  servidor = createServer((socket) => {
    conexiones.push(socket);
    responderSoloElArranque(socket);
  });
  await new Promise<void>((resolver) => servidor.listen(0, '127.0.0.1', resolver));
  const { port } = servidor.address() as AddressInfo;
  cliente = crearClienteRedis({
    servidor: '127.0.0.1',
    puerto: port,
    contrasena: 'x',
    baseDatos: 0,
  });
  await cliente.connect();
});

afterEach(async () => {
  cliente.disconnect();
  for (const socket of conexiones) socket.destroy();
  await new Promise((resolver) => servidor.close(resolver));
});

describe('Redis colgado con la conexión abierta (RNF-2, N-15)', () => {
  it('la versión de sesión responde a tiempo en lugar de colgar cada petición autenticada', async () => {
    const versiones = crearVersionesSesionRedis(cliente, pino({ level: 'silent' }));
    const inicio = Date.now();

    await expect(versiones.vigente(7)).resolves.toBeNull();

    expect(Date.now() - inicio).toBeLessThan(ESPERA_MAXIMA_MS);
  });

  it('el limitador cae al contador en memoria a tiempo en lugar de colgar el login', async () => {
    const limitador = crearLimitadorRedis(cliente, {
      prefijo: 'prueba-colgado',
      intentos: 5,
      ventanaSeg: 60,
    });
    const inicio = Date.now();

    await expect(limitador.consumir('clave')).resolves.toMatchObject({ permitido: true });

    expect(Date.now() - inicio).toBeLessThan(ESPERA_MAXIMA_MS);
  });
});
