import { crearConexion } from './conexion';
import { crearBloqueoDelNavegador, crearCanalDelNavegador } from './sesion/navegador';

export { crearQueryClient } from './consultas';
export { ErrorApi } from './ErrorApi';
export type { Cuerpo, Respuesta } from './tipos';
export type {
  Canal,
  DatosSesion,
  EstadoSesion,
  MensajeSesion,
  Rol,
  Sesion,
  Usuario,
} from './sesion/sesion';

/** La única sesión y el único cliente de la API de la aplicación (FE-05, FE-13). */
export const { sesion, api } = crearConexion({
  bloqueo: crearBloqueoDelNavegador(),
  canal: crearCanalDelNavegador(),
});
