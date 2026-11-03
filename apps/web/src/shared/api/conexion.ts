import { crearClienteApi, type CopiaDePeticion } from './cliente';
import { cerrarSesionEnServidor, refrescarSesion } from './sesion/sesion.api';
import { crearSesion, type Bloqueo, type Canal } from './sesion/sesion';

interface OpcionesConexion {
  bloqueo: Bloqueo;
  canal: Canal;
  /** Las copias de las peticiones en vuelo; las pruebas pasan la suya para ver que no quedan copias sin borrar. */
  copias?: Map<string, CopiaDePeticion>;
}

/** La sesión y el cliente `api` se necesitan mutuamente: la sesión renueva con el cliente y el cliente usa su token. */
export function crearConexion({ bloqueo, canal, copias }: OpcionesConexion) {
  const sesion = crearSesion({
    refrescar: () => refrescarSesion(api),
    cerrarEnServidor: () => cerrarSesionEnServidor(api),
    bloqueo,
    canal,
  });
  const api = crearClienteApi(sesion, copias);
  return { sesion, api };
}
