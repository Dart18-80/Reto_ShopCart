import { afterEach, describe, expect, it } from 'vitest';
import { crearClienteRedis, crearVerificadorRedis } from '../../../src/shared/adapters/redis.js';
import { cargarConfiguracion } from '../../../src/shared/config/index.js';

type ClienteRedis = ReturnType<typeof crearClienteRedis>;

const abiertos: ClienteRedis[] = [];

afterEach(() => {
  for (const cliente of abiertos.splice(0)) cliente.disconnect();
});

function crearCliente(contrasena: string): { cliente: ClienteRedis; errores: Error[] } {
  const { redis } = cargarConfiguracion(process.env);
  const cliente = crearClienteRedis({ ...redis, contrasena });
  const errores: Error[] = [];
  // Igual que server.ts: el fallo llega por el evento 'error', que se registra y nunca tumba el proceso.
  cliente.on('error', (error: Error) => errores.push(error));
  abiertos.push(cliente);
  return { cliente, errores };
}

describe('Redis real (requirepass)', () => {
  it('con la contraseña correcta el PING responde', async () => {
    const { cliente } = crearCliente(cargarConfiguracion(process.env).redis.contrasena);
    await cliente.connect();

    await expect(crearVerificadorRedis(cliente).ping()).resolves.toBe(true);
  });

  it('con una contraseña incorrecta el health ve Redis degradado, sin excepción', async () => {
    const { cliente, errores } = crearCliente('incorrecta-para-la-prueba');
    await cliente.connect().catch(() => undefined);

    await expect(crearVerificadorRedis(cliente).ping()).resolves.toBe(false);
    expect(errores.map((error) => error.message).join(' ')).toMatch(/WRONGPASS/);
  });
});
