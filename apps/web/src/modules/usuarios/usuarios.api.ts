import type { ActualizarPerfil, CambiarContrasena } from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type Perfil = Respuesta<'/api/v1/usuarios/me', 'get'>['datos'];
export type SesionRenovada = Respuesta<'/api/v1/usuarios/me/contrasena', 'post'>['datos'];

// El middleware de errores ya convirtió toda respuesta de error en ErrorApi: un 2xx sin cuerpo es inesperado.
function datosDe<D>(data: { datos: D } | undefined): D {
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

export async function obtenerPerfil(): Promise<Perfil> {
  const { data } = await api.GET('/api/v1/usuarios/me');
  return datosDe(data);
}

export async function actualizarPerfil(cambios: ActualizarPerfil): Promise<Perfil> {
  const { data } = await api.PATCH('/api/v1/usuarios/me', { body: cambios });
  return datosDe(data);
}

export async function cambiarContrasena(datos: CambiarContrasena): Promise<SesionRenovada> {
  const { data } = await api.POST('/api/v1/usuarios/me/contrasena', { body: datos });
  return datosDe(data);
}
