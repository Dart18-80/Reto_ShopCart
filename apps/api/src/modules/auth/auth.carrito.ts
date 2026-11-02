import { ejecutarConContexto, obtenerContexto } from '../../shared/http/index.js';
import type { AvisoFusionCarrito, CarritoDeInvitado, UsuarioSesion } from './auth.types.js';

/** Lo que pasó con el carrito de la cookie al abrir sesión. */
export interface CarritoAlAbrirSesion {
  /** El carrito de invitado ya es del cliente (o la cookie no tenía carrito): la cookie se borra. */
  cookieConsumida: boolean;
  avisos: AvisoFusionCarrito[];
}

// Una fábrica y no una constante: nunca se comparte un objeto mutable entre peticiones.
const sinCambios = (): CarritoAlAbrirSesion => ({ cookieConsumida: false, avisos: [] });

/**
 * N-05: al iniciar sesión, el carrito de invitado se fusiona con el del cliente; al registrarse, pasa a ser
 * suyo. Solo el rol Cliente tiene carrito: con otro rol la cookie queda como está. Si falla, la sesión se
 * abre igual y el carrito de invitado queda intacto.
 */
export function crearCarritoAlAbrirSesion(carrito: CarritoDeInvitado) {
  // A-18: los SPs del carrito toman al cliente del contexto. Solo esa llamada corre como él; el resto de la
  // petición sigue siendo anónima (el login no lleva token).
  function comoCliente<T>(usuario: UsuarioSesion, accion: () => Promise<T>): Promise<T> {
    const contexto = obtenerContexto();
    if (contexto === undefined)
      throw new Error('El carrito de invitado se procesó fuera de una petición');
    return ejecutarConContexto(
      { requestId: contexto.requestId, idUsuario: usuario.idUsuario, rol: usuario.rol },
      accion,
    );
  }

  return {
    async alIniciarSesion(
      usuario: UsuarioSesion,
      tokenInvitado: string | undefined,
    ): Promise<CarritoAlAbrirSesion> {
      if (tokenInvitado === undefined || usuario.rol !== 'Cliente') return sinCambios();
      const avisos = await comoCliente(usuario, () => carrito.fusionar(tokenInvitado));
      return avisos === null ? sinCambios() : { cookieConsumida: true, avisos };
    },

    async alRegistrarse(
      usuario: UsuarioSesion,
      tokenInvitado: string | undefined,
    ): Promise<CarritoAlAbrirSesion> {
      if (tokenInvitado === undefined) return sinCambios();
      const asignado = await comoCliente(usuario, () => carrito.asignar(tokenInvitado));
      return asignado ? { cookieConsumida: true, avisos: [] } : sinCambios();
    },
  };
}

export type CarritoAlAbrirSesionService = ReturnType<typeof crearCarritoAlAbrirSesion>;
