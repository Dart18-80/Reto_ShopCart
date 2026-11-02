import { Decimal } from 'decimal.js';
import { AppError } from '../../shared/errors/index.js';
import {
  generarTokenOpaco,
  hashearTokenOpaco,
  type LimitadorIntentos,
} from '../../shared/http/index.js';
import type { CarritoRepository } from './carrito.repository.js';
import type {
  Carrito,
  CarritoConCookie,
  Comprador,
  ConsultaCarrito,
  NuevaLinea,
} from './carrito.types.js';

interface Dependencias {
  repositorio: Pick<
    CarritoRepository,
    | 'obtener'
    | 'agregarLinea'
    | 'marcarAvisosVistos'
    | 'actualizarCantidad'
    | 'eliminarLinea'
    | 'aplicarCupon'
    | 'quitarCupon'
  >;
  /** 01 §5.3: creación de carritos de invitado por IP. */
  limitadorCreacion: LimitadorIntentos;
}

const SIN_IP = 'desconocida';
const SIN_COOKIE = { hashActual: null, hashNuevo: null };

// Una fábrica y no una constante: nunca se comparte un objeto mutable entre peticiones.
const carritoVacio = (): Carrito => ({
  lineas: [],
  resumen: {
    lineas: 0,
    unidades: 0,
    subtotal: new Decimal(0),
    descuento: new Decimal(0),
    total: new Decimal(0),
    puedePagar: false,
    cupon: null,
    cuponRetirado: null,
    // Sin carrito no se consulta el parámetro: el SPA lo muestra al agregar el primer producto.
    envioGratis: null,
  },
});

/** N-05: con sesión manda el carrito del cliente (la cookie no se usa); sin sesión, el de la cookie. */
function hashDe(comprador: Comprador): Buffer | null {
  return comprador.tipo === 'invitado' && comprador.token !== undefined
    ? hashearTokenOpaco(comprador.token)
    : null;
}

export function crearCarritoService({ repositorio, limitadorCreacion }: Dependencias) {
  // N-05: creación perezosa con un token nuevo, nunca con uno que mandó el cliente.
  async function crearCarritoInvitado(
    linea: NuevaLinea,
    ip: string | null,
  ): Promise<CarritoConCookie> {
    const { permitido, segundosParaReintentar } = await limitadorCreacion.consumir(ip ?? SIN_IP);
    if (!permitido) throw new AppError('DEMASIADAS_PETICIONES', { segundosParaReintentar });

    const { token, hash } = generarTokenOpaco();
    const carrito = await repositorio.agregarLinea(linea, { hashActual: null, hashNuevo: hash });
    if (carrito === null) throw new Error('SP_Carrito_AgregarLinea no creó el carrito de invitado');
    return { carrito, tokenNuevo: token };
  }

  async function agregarAlCarritoDelCliente(linea: NuevaLinea): Promise<CarritoConCookie> {
    const carrito = await repositorio.agregarLinea(linea, SIN_COOKIE);
    if (carrito === null)
      throw new Error('SP_Carrito_AgregarLinea no devolvió el carrito del cliente');
    return { carrito, tokenNuevo: null };
  }

  return {
    async obtener(comprador: Comprador): Promise<ConsultaCarrito> {
      const hash = hashDe(comprador);
      const carrito = await repositorio.obtener(hash);
      return {
        carrito: carrito ?? carritoVacio(),
        cookieObsoleta: hash !== null && carrito === null,
      };
    },

    async agregarLinea(comprador: Comprador, linea: NuevaLinea): Promise<CarritoConCookie> {
      if (comprador.tipo === 'cliente') return agregarAlCarritoDelCliente(linea);

      const hashActual = hashDe(comprador);
      const carrito =
        hashActual === null
          ? null
          : await repositorio.agregarLinea(linea, { hashActual, hashNuevo: null });
      // Sin cookie, o con una cuyo carrito ya no está Activo: se crea otro.
      return carrito === null
        ? crearCarritoInvitado(linea, comprador.ip)
        : { carrito, tokenNuevo: null };
    },

    // Una línea de otro carrito responde 404, igual que una inexistente (RF-01): lo decide el SP.
    actualizarCantidad: (
      comprador: Comprador,
      idLinea: number,
      cantidad: number,
    ): Promise<Carrito> => repositorio.actualizarCantidad(idLinea, cantidad, hashDe(comprador)),

    // N-12: cada causa de rechazo responde su propio código; lo decide el SP con FU_Cupones_Validar.
    async aplicarCupon(comprador: Comprador, codigo: string): Promise<Carrito> {
      return repositorio.aplicarCupon(codigo, hashDe(comprador));
    },

    async quitarCupon(comprador: Comprador): Promise<Carrito> {
      return (await repositorio.quitarCupon(hashDe(comprador))) ?? carritoVacio();
    },

    async marcarAvisosVistos(comprador: Comprador): Promise<Carrito> {
      return (await repositorio.marcarAvisosVistos(hashDe(comprador))) ?? carritoVacio();
    },

    eliminarLinea: (comprador: Comprador, idLinea: number): Promise<Carrito> =>
      repositorio.eliminarLinea(idLinea, hashDe(comprador)),
  };
}

export type CarritoService = ReturnType<typeof crearCarritoService>;
