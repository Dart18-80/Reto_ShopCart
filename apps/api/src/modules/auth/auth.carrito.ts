import { establecerUsuario } from '../../shared/http/index.js';
import type { AvisoFusionCarrito, CarritoDeInvitado, UsuarioSesion } from './auth.types.js';

/** Lo que pasó con el carrito de la cookie al abrir sesión. */
export interface CarritoAlAbrirSesion {
  /** El carrito de invitado ya es del cliente (o la cookie no tenía carrito): la cookie se borra. */
  cookieConsumida: boolean;
  avisos: AvisoFusionCarrito[];
}

const SIN_CAMBIOS: CarritoAlAbrirSesion = { cookieConsumida: false, avisos: [] };

/**
 * N-05: al iniciar sesión, el carrito de invitado se fusiona con el del cliente; al registrarse, pasa a ser
 * suyo. Solo el rol Cliente tiene carrito: con otro rol la cookie queda como está. Si falla, la sesión se
 * abre igual y el carrito de invitado queda intacto.
 */
export function crearCarritoAlAbrirSesion(carrito: CarritoDeInvitado) {
  // A-18: desde aquí la petición actúa como quien abrió la sesión; los SPs del carrito lo toman del contexto.
  function actuarComo(usuario: UsuarioSesion): void {
    establecerUsuario(usuario.idUsuario, usuario.rol);
  }

  return {
    async alIniciarSesion(
      usuario: UsuarioSesion,
      tokenInvitado: string | undefined,
    ): Promise<CarritoAlAbrirSesion> {
      if (tokenInvitado === undefined || usuario.rol !== 'Cliente') return SIN_CAMBIOS;
      actuarComo(usuario);
      const avisos = await carrito.fusionar(tokenInvitado);
      return avisos === null ? SIN_CAMBIOS : { cookieConsumida: true, avisos };
    },

    async alRegistrarse(
      usuario: UsuarioSesion,
      tokenInvitado: string | undefined,
    ): Promise<CarritoAlAbrirSesion> {
      if (tokenInvitado === undefined) return SIN_CAMBIOS;
      actuarComo(usuario);
      const asignado = await carrito.asignar(tokenInvitado);
      return asignado ? { cookieConsumida: true, avisos: [] } : SIN_CAMBIOS;
    },
  };
}

export type CarritoAlAbrirSesionService = ReturnType<typeof crearCarritoAlAbrirSesion>;
