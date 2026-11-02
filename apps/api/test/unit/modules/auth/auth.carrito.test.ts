import { describe, expect, it, vi } from 'vitest';
import { crearCarritoAlAbrirSesion } from '../../../../src/modules/auth/auth.carrito.js';
import type { UsuarioSesion } from '../../../../src/modules/auth/auth.types.js';
import { ejecutarConContexto, obtenerContexto } from '../../../../src/shared/http/index.js';

const TOKEN = 'z'.repeat(43);
const CLIENTE: UsuarioSesion = { idUsuario: 9, correo: 'a@b.gt', nombre: 'Ana', rol: 'Cliente' };
const AVISO = {
  idVariante: 1,
  producto: 'Camiseta',
  tipo: 'CantidadAjustada' as const,
  cantidadSolicitada: 6,
  cantidadFinal: 5,
};

function preparar(fusion: (typeof AVISO)[] | null = [AVISO], asignado = true) {
  const carrito = {
    fusionar: vi.fn((_token: string) => Promise.resolve(fusion)),
    asignar: vi.fn((_token: string) => Promise.resolve(asignado)),
  };
  return { politica: crearCarritoAlAbrirSesion(carrito), carrito };
}

const enPeticion = <T>(accion: () => Promise<T>) =>
  ejecutarConContexto({ requestId: 'r-1', idUsuario: null, rol: null }, accion);

describe('carrito de invitado al abrir sesión (E4-H03, N-05)', () => {
  it('al iniciar sesión fusiona como el cliente y consume la cookie', async () => {
    const { politica, carrito } = preparar();

    const { resultado, contexto } = await enPeticion(async () => ({
      resultado: await politica.alIniciarSesion(CLIENTE, TOKEN),
      contexto: obtenerContexto(),
    }));

    expect(resultado).toEqual({ cookieConsumida: true, avisos: [AVISO] });
    expect(carrito.fusionar).toHaveBeenCalledWith(TOKEN);
    expect(contexto).toMatchObject({ idUsuario: 9, rol: 'Cliente' });
  });

  it('si la fusión falla, la cookie queda', async () => {
    const { politica } = preparar(null);

    const resultado = await enPeticion(() => politica.alIniciarSesion(CLIENTE, TOKEN));

    expect(resultado).toEqual({ cookieConsumida: false, avisos: [] });
  });

  it('sin cookie o con un rol distinto de Cliente no hace nada', async () => {
    const { politica, carrito } = preparar();

    const sinCookie = await enPeticion(() => politica.alIniciarSesion(CLIENTE, undefined));
    const operador = await enPeticion(() =>
      politica.alIniciarSesion({ ...CLIENTE, rol: 'Operador' }, TOKEN),
    );

    expect([sinCookie.cookieConsumida, operador.cookieConsumida]).toEqual([false, false]);
    expect(carrito.fusionar).not.toHaveBeenCalled();
  });

  it('al registrarse asigna el carrito; si falla, la cookie queda', async () => {
    const asignado = await enPeticion(() => preparar().politica.alRegistrarse(CLIENTE, TOKEN));
    const fallido = await enPeticion(() =>
      preparar([AVISO], false).politica.alRegistrarse(CLIENTE, TOKEN),
    );

    expect(asignado).toEqual({ cookieConsumida: true, avisos: [] });
    expect(fallido).toEqual({ cookieConsumida: false, avisos: [] });
  });
});
