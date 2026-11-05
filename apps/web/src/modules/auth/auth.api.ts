import type { DatosLogin, DatosRegistro } from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type SesionAbierta = Respuesta<'/api/v1/auth/login', 'post'>['datos'];

// El middleware de errores ya convirtió toda respuesta de error en ErrorApi: un 2xx sin cuerpo es inesperado.
function sesionDe(data: { datos: SesionAbierta } | undefined): SesionAbierta {
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

export async function ingresar(datos: DatosLogin): Promise<SesionAbierta> {
  const { data } = await api.POST('/api/v1/auth/login', { body: datos });
  return sesionDe(data);
}

export async function registrarse(datos: DatosRegistro): Promise<SesionAbierta> {
  const { data } = await api.POST('/api/v1/auth/registro', { body: datos });
  return sesionDe(data);
}
