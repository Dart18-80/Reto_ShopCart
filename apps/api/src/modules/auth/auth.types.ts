import type { Rol } from '../../shared/http/index.js';

export interface UsuarioSesion {
  idUsuario: number;
  correo: string;
  nombre: string;
  rol: Rol;
}

export interface Credenciales extends UsuarioSesion {
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
