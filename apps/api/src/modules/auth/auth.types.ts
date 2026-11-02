import type { AvisoFusion } from '../carrito/index.js';
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

/** N-05: lo que pasó con el carrito de la cookie al abrir sesión. */
export interface CarritoAlAbrirSesion {
  /** El carrito de invitado ya es del cliente (o la cookie no tenía carrito): la cookie se borra. */
  cookieConsumida: boolean;
  avisos: AvisoFusion[];
}

/** Lo que obtiene quien inicia sesión o se registra. */
export interface SesionAbierta {
  sesion: Sesion;
  carrito: CarritoAlAbrirSesion;
}
