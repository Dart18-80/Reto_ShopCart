import { Decimal } from 'decimal.js';
import { describe, expect, it, vi } from 'vitest';
import type { CarritoRepository } from '../../../../src/modules/carrito/carrito.repository.js';
import { crearCarritoService } from '../../../../src/modules/carrito/carrito.service.js';
import type {
  Carrito,
  CookieInvitado,
  NuevaLinea,
} from '../../../../src/modules/carrito/carrito.types.js';
import { AppError } from '../../../../src/shared/errors/index.js';
import { hashearTokenOpaco, type LimitadorIntentos } from '../../../../src/shared/http/index.js';

const CARRITO: Carrito = {
  lineas: [],
  resumen: {
    lineas: 1,
    unidades: 2,
    subtotal: new Decimal('20.00'),
    descuento: new Decimal(0),
    total: new Decimal('20.00'),
    puedePagar: true,
  },
};
const LINEA: NuevaLinea = { idVariante: 7, cantidad: 2 };
const TOKEN = 'a'.repeat(43);
const IP = '10.0.0.1';

interface Opciones {
  /** Lo que devuelve SP_Carrito_AgregarLinea con la cookie actual (null: no tiene carrito Activo). */
  conCookie?: Carrito | null;
  permitido?: boolean;
}

function preparar({ conCookie = CARRITO, permitido = true }: Opciones = {}) {
  const repositorio = {
    obtener: vi.fn((_hash: Buffer | null) => Promise.resolve(conCookie)),
    agregarLinea: vi.fn((_linea: NuevaLinea, cookie: CookieInvitado) =>
      Promise.resolve(cookie.hashNuevo === null ? conCookie : CARRITO),
    ),
    actualizarCantidad: vi.fn((_id: number, _cantidad: number, _hash: Buffer | null) =>
      Promise.resolve(CARRITO),
    ),
    eliminarLinea: vi.fn((_id: number, _hash: Buffer | null) => Promise.resolve(CARRITO)),
    marcarAvisosVistos: vi.fn((_hash: Buffer | null) => Promise.resolve(conCookie)),
  } satisfies CarritoRepository;
  const consumir = vi.fn((_clave: string) =>
    Promise.resolve({ permitido, segundosParaReintentar: permitido ? 0 : 30 }),
  );
  const limitadorCreacion: LimitadorIntentos = { consumir };
  return {
    servicio: crearCarritoService({ repositorio, limitadorCreacion }),
    repositorio,
    consumir,
  };
}

const invitado = (token?: string) => ({ tipo: 'invitado' as const, token, ip: IP });

describe('carrito.service (E4-H01, N-05)', () => {
  it('el cliente usa su carrito sin cookie y no consume el límite de invitados', async () => {
    const { servicio, repositorio, consumir } = preparar();

    const resultado = await servicio.agregarLinea({ tipo: 'cliente' }, LINEA);

    expect(resultado.tokenNuevo).toBeNull();
    expect(repositorio.agregarLinea).toHaveBeenCalledWith(LINEA, {
      hashActual: null,
      hashNuevo: null,
    });
    expect(consumir).not.toHaveBeenCalled();
  });

  it('un invitado con un carrito Activo agrega en él, sin token nuevo ni consumo del límite', async () => {
    const { servicio, repositorio, consumir } = preparar();

    const resultado = await servicio.agregarLinea(invitado(TOKEN), LINEA);

    expect(resultado.tokenNuevo).toBeNull();
    expect(repositorio.agregarLinea).toHaveBeenCalledWith(LINEA, {
      hashActual: hashearTokenOpaco(TOKEN),
      hashNuevo: null,
    });
    expect(consumir).not.toHaveBeenCalled();
  });

  it('un invitado sin cookie crea el carrito con un token nuevo y consume el límite por IP', async () => {
    const { servicio, repositorio, consumir } = preparar();

    const { tokenNuevo } = await servicio.agregarLinea(invitado(), LINEA);

    expect(consumir).toHaveBeenCalledWith(IP);
    expect(tokenNuevo).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(repositorio.agregarLinea).toHaveBeenCalledTimes(1);
    expect(repositorio.agregarLinea).toHaveBeenCalledWith(LINEA, {
      hashActual: null,
      hashNuevo: hashearTokenOpaco(tokenNuevo ?? ''),
    });
  });

  it('una cookie sin carrito Activo crea otro con un token distinto del que mandó el cliente', async () => {
    const { servicio, consumir } = preparar({ conCookie: null });

    const { tokenNuevo } = await servicio.agregarLinea(invitado(TOKEN), LINEA);

    expect(consumir).toHaveBeenCalledTimes(1);
    expect(tokenNuevo).not.toBeNull();
    expect(tokenNuevo).not.toBe(TOKEN);
  });

  it('con el límite agotado responde DEMASIADAS_PETICIONES con los segundos para reintentar y no crea nada', async () => {
    const { servicio, repositorio } = preparar({ permitido: false });

    const error = await servicio.agregarLinea(invitado(), LINEA).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ codigo: 'DEMASIADAS_PETICIONES', segundosParaReintentar: 30 });
    expect(repositorio.agregarLinea).not.toHaveBeenCalled();
  });

  it('sin carrito responde uno vacío; si había cookie, la marca como obsoleta', async () => {
    const { servicio } = preparar({ conCookie: null });

    const sinCookie = await servicio.obtener(invitado());
    const conCookie = await servicio.obtener(invitado(TOKEN));

    expect(sinCookie.cookieObsoleta).toBe(false);
    expect(conCookie.cookieObsoleta).toBe(true);
    expect(conCookie.carrito.lineas).toEqual([]);
    expect(conCookie.carrito.resumen.total.toFixed(2)).toBe('0.00');
  });

  it('el cliente sin carrito nunca marca obsoleta una cookie de invitado', async () => {
    const { servicio, repositorio } = preparar({ conCookie: null });

    const consulta = await servicio.obtener({ tipo: 'cliente' });

    expect(consulta.cookieObsoleta).toBe(false);
    expect(repositorio.obtener).toHaveBeenCalledWith(null);
  });

  it('PATCH y DELETE de un invitado viajan con el hash de su cookie, nunca con el token', async () => {
    const { servicio, repositorio } = preparar();

    await servicio.actualizarCantidad(invitado(TOKEN), 4, 3);
    await servicio.eliminarLinea(invitado(TOKEN), 4);

    expect(repositorio.actualizarCantidad).toHaveBeenCalledWith(4, 3, hashearTokenOpaco(TOKEN));
    expect(repositorio.eliminarLinea).toHaveBeenCalledWith(4, hashearTokenOpaco(TOKEN));
  });
});
