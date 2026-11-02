import { EventEmitter } from 'node:events';
import { pino } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { CANAL_AVISOS, crearAvisosRedis } from '../../../../src/shared/adapters/avisos-redis.js';

function suscriptorFalso() {
  const suscriptor = Object.assign(new EventEmitter(), {
    connect: vi.fn(() => Promise.resolve()),
    subscribe: vi.fn((_canal: string) => Promise.resolve(1)),
    quit: vi.fn(() => Promise.resolve('OK' as const)),
  });
  return suscriptor;
}

function preparar() {
  const suscriptor = suscriptorFalso();
  const cliente = {
    publish: vi.fn((_canal: string, _mensaje: string) => Promise.resolve(1)),
    duplicate: vi.fn(() => suscriptor),
  };
  const lineas: { level: number; msg: string }[] = [];
  const logger = pino(
    { level: 'info' },
    {
      write: (linea: string) => {
        lineas.push(JSON.parse(linea) as { level: number; msg: string });
      },
    },
  );
  return { avisos: crearAvisosRedis(cliente, logger), cliente, suscriptor, lineas };
}

describe('avisos de versión sobre Redis pub/sub (E9-H02, A-25)', () => {
  it('publica el aviso como JSON en su canal', async () => {
    const { avisos, cliente } = preparar();

    await avisos.publicar({ dominio: 'ventas', version: 4 });

    expect(cliente.publish).toHaveBeenCalledWith(CANAL_AVISOS, '{"dominio":"ventas","version":4}');
  });

  it('con Redis caído publicar no lanza: el aviso se pierde y se registra una vez', async () => {
    const { avisos, cliente, lineas } = preparar();
    cliente.publish.mockRejectedValue(new Error('Connection is closed.'));

    await expect(avisos.publicar({ dominio: 'ventas', version: 4 })).resolves.toBeUndefined();
    await avisos.publicar({ dominio: 'ventas', version: 5 });

    expect(lineas.filter((l) => l.level === 40)).toHaveLength(1);
  });

  it('se suscribe con una conexión propia y entrega cada aviso válido de su canal', async () => {
    const { avisos, cliente, suscriptor } = preparar();
    const alRecibir = vi.fn();
    avisos.suscribir({ alRecibir, alReconectar: vi.fn() });

    suscriptor.emit('ready');
    await vi.waitFor(() => {
      expect(suscriptor.subscribe).toHaveBeenCalledWith(CANAL_AVISOS);
    });
    suscriptor.emit('message', CANAL_AVISOS, '{"dominio":"carritos","version":8}');
    suscriptor.emit('message', CANAL_AVISOS, 'no es json');
    suscriptor.emit('message', 'otro-canal', '{"dominio":"ventas","version":1}');

    expect(cliente.duplicate).toHaveBeenCalledTimes(1);
    expect(suscriptor.connect).toHaveBeenCalledTimes(1);
    expect(alRecibir.mock.calls).toEqual([[{ dominio: 'carritos', version: 8 }]]);
  });

  it('cuando la suscripción vuelve después de una caída avisa al oyente, una vez por caída', () => {
    const { avisos, suscriptor, lineas } = preparar();
    const alReconectar = vi.fn();
    avisos.suscribir({ alRecibir: vi.fn(), alReconectar });

    suscriptor.emit('ready');
    suscriptor.emit('error', new Error('ECONNRESET'));
    suscriptor.emit('error', new Error('ECONNREFUSED'));
    suscriptor.emit('ready');

    expect(alReconectar).toHaveBeenCalledTimes(1);
    expect(lineas.filter((l) => l.level === 40)).toHaveLength(1);
  });

  it('cerrar termina la conexión de suscripción (apagado)', async () => {
    const { avisos, suscriptor } = preparar();
    avisos.suscribir({ alRecibir: vi.fn(), alReconectar: vi.fn() });

    await avisos.cerrar();

    expect(suscriptor.quit).toHaveBeenCalledTimes(1);
  });
});
