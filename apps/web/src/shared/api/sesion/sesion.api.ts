import type { ClienteApi } from '../cliente';
import { ErrorApi } from '../ErrorApi';
import type { DatosSesion } from './sesion';

// El cliente llega como parámetro para no importar `api` (que a su vez necesita la sesión).
export async function refrescarSesion(api: ClienteApi): Promise<DatosSesion> {
  const { data } = await api.POST('/api/v1/auth/refresh');
  // Un 2xx sin cuerpo no cumple el contrato: es una respuesta inesperada, como cualquier otra (FE-13).
  if (data === undefined) throw ErrorApi.inesperado();
  return data.datos;
}

export async function cerrarSesionEnServidor(api: ClienteApi): Promise<void> {
  await api.POST('/api/v1/auth/logout');
}
