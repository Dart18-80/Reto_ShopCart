import type { RolDeUsuario } from '../../shared/http/index.js';

export interface UsuarioSesion {
  idUsuario: number;
  correo: string;
  nombre: string;
  rol: RolDeUsuario;
}

/** A-07: la versión de sesión va en el access token, nunca en la respuesta. */
export interface IdentidadSesion extends UsuarioSesion {
  versionSesion: number;
}

export interface Credenciales extends IdentidadSesion {
  hashContrasena: string;
  activo: boolean;
}

/** Lo que obtiene quien inicia sesión. El refresh token solo viaja en la cookie. */
export interface Sesion {
  accessToken: string;
  expiraEn: number;
  refreshToken: string;
  usuario: UsuarioSesion;
}

/** N-05: una línea del invitado que no pasó completa al carrito del cliente al iniciar sesión. */
export interface AvisoFusionCarrito {
  idVariante: number;
  producto: string;
  tipo: 'CantidadAjustada' | 'NoFusionada';
  cantidadSolicitada: number;
  cantidadFinal: number;
}

/**
 * Puerto (N-05): el carrito de invitado al abrir sesión. Lo implementa el módulo carrito y se inyecta en
 * app.ts. Si falla, devuelve null o false: el carrito de invitado queda intacto y el error ya se registró.
 */
export interface CarritoDeInvitado {
  fusionar(tokenInvitado: string): Promise<AvisoFusionCarrito[] | null>;
  asignar(tokenInvitado: string): Promise<boolean>;
}
