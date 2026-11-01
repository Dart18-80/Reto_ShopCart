import type { Rol } from '../../shared/http/index.js';

export interface UsuarioSesion {
  idUsuario: number;
  correo: string;
  nombre: string;
  rol: Rol;
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
