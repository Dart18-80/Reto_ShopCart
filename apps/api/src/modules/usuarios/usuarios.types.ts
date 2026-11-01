import type { Rol } from '../../shared/http/index.js';

export interface Usuario {
  idUsuario: number;
  correo: string;
  nombre: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
}

/** Resultado de un cambio que puede subir la versión de sesión (A-07): la API la publica en Redis. */
export interface UsuarioConVersion {
  usuario: Usuario;
  versionSesion: number;
}

/** El perfil propio con el hash, solo para verificar la contraseña actual. Nunca sale del servicio. */
export interface PerfilConHash extends Usuario {
  hashContrasena: string;
}

export interface FiltrosUsuarios {
  pagina: number;
  tamano: number;
  rol: Rol | null;
  activo: boolean | null;
}
