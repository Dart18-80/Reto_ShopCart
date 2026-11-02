import { Writable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { crearCarritoDeInvitado } from '../../../../src/modules/carrito/carrito.sesion.js';
import { crearLogger } from '../../../../src/shared/observability/index.js';

const TOKEN = 'z'.repeat(43);

function preparar(error: Error) {
  const lineas: string[] = [];
  const destino = new Writable({
    write(fragmento: Buffer, _codificacion, listo) {
      lineas.push(fragmento.toString());
      listo();
    },
  });
  const repositorio = {
    fusionar: vi.fn((_hash: Buffer) => Promise.reject(error)),
    asignarInvitado: vi.fn((_hash: Buffer) => Promise.reject(error)),
  };
  const carrito = crearCarritoDeInvitado({ repositorio, logger: crearLogger({ destino }) });
  return { carrito, log: () => lineas.join('') };
}

describe('carrito de invitado al abrir sesión (E4-H03, N-05)', () => {
  it('si la fusión falla devuelve null y registra el error con su causa, sin el token', async () => {
    const { carrito, log } = preparar(new Error('deadlock simulado'));

    const resultado = await carrito.fusionar(TOKEN);

    expect(resultado).toBeNull();
    expect(log()).toContain('No se pudo fusionar el carrito de invitado');
    expect(log()).toContain('deadlock simulado');
    expect(log()).not.toContain(TOKEN);
  });

  it('si la asignación falla devuelve false y registra el error con su causa', async () => {
    const { carrito, log } = preparar(new Error('índice único'));

    const resultado = await carrito.asignar(TOKEN);

    expect(resultado).toBe(false);
    expect(log()).toContain('No se pudo asignar el carrito de invitado');
    expect(log()).toContain('índice único');
  });
});
