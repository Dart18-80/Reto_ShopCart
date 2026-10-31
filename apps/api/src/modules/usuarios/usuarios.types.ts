import type { Rol } from '../../shared/http/index.js';

export interface Usuario {
  idUsuario: number;
  correo: string;
  nombre: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
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
