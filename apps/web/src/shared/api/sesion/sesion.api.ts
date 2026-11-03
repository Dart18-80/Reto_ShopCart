import type { ClienteApi } from '../cliente';
import type { DatosSesion } from './sesion';

const SIN_DATOS =
  'El middleware de errores convierte toda respuesta de error en ErrorApi: una respuesta exitosa trae datos.';

// El cliente llega como parámetro para no importar `api` (que a su vez necesita la sesión).
export async function refrescarSesion(api: ClienteApi): Promise<DatosSesion> {
  const { data } = await api.POST('/api/v1/auth/refresh');
  if (data === undefined) throw new Error(SIN_DATOS);
  return data.datos;
}

export async function cerrarSesionEnServidor(api: ClienteApi): Promise<void> {
  await api.POST('/api/v1/auth/logout');
}
