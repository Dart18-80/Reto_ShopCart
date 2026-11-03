import type { EstadoSesion, Rol } from '../shared/api';

/** Quién entra a una ruta: los roles con sesión y si un invitado también. Refleja `autorizar(...)` del backend. */
export interface Acceso {
  readonly invitado: boolean;
  readonly roles: readonly Rol[];
}

const TODOS_LOS_ROLES: readonly Rol[] = ['Cliente', 'Operador', 'Administrador'];

export const PUBLICO: Acceso = { invitado: true, roles: TODOS_LOS_ROLES };
export const CON_SESION: Acceso = { invitado: false, roles: TODOS_LOS_ROLES };
/** El carrito: invitado o Cliente; el personal recibe 403 (autorizarSiHaySesion('Cliente')). */
export const INVITADO_O_CLIENTE: Acceso = { invitado: true, roles: ['Cliente'] };
export const SOLO_CLIENTE: Acceso = { invitado: false, roles: ['Cliente'] };
export const PERSONAL: Acceso = { invitado: false, roles: ['Operador', 'Administrador'] };
export const SOLO_ADMINISTRADOR: Acceso = { invitado: false, roles: ['Administrador'] };

export type Permiso = 'permitido' | 'verificando' | 'sinVerificar' | 'ingresar' | 'sinPermiso';

/**
 * FE-04: lo que el guardián y los menús hacen con una ruta. Es experiencia de usuario; la autoridad es el backend
 * (RF-01). Mientras no se sabe si hay sesión, lo que admite invitados se muestra y lo demás espera.
 */
export function permisoPara(acceso: Acceso, estado: EstadoSesion): Permiso {
  if (estado.tipo === 'activa') {
    return acceso.roles.includes(estado.usuario.rol) ? 'permitido' : 'sinPermiso';
  }
  if (acceso.invitado) return 'permitido';
  const sinSesion = {
    invitado: 'ingresar',
    rehidratando: 'verificando',
    noVerificada: 'sinVerificar',
  } as const;
  return sinSesion[estado.tipo];
}
