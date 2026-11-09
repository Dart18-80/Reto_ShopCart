import type {
  ActualizarPerfil,
  ActualizarUsuario,
  CambiarContrasena,
  ConsultaUsuarios,
  CrearUsuarioInterno,
} from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type Perfil = Respuesta<'/api/v1/usuarios/me', 'get'>['datos'];
export type ListaUsuarios = Respuesta<'/api/v1/usuarios', 'get'>;
export type UsuarioAdmin = ListaUsuarios['datos'][number];
export type AccionUsuario = 'activar' | 'desactivar';
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

// --- Usuarios del Admin (M10-H01, N-15): el backend decide lo que no se puede (último Admin, uno mismo).

/** La consulta validada vuelve a la forma de la query string: el booleano viaja como 'true' o 'false'. */
export async function listarUsuarios({
  activo,
  ...consulta
}: ConsultaUsuarios): Promise<ListaUsuarios> {
  const { data } = await api.GET('/api/v1/usuarios', {
    params: {
      query: { ...consulta, activo: activo === undefined ? undefined : activo ? 'true' : 'false' },
    },
  });
  if (!data) throw ErrorApi.inesperado();
  return data;
}

export async function crearUsuarioInterno(datos: CrearUsuarioInterno): Promise<UsuarioAdmin> {
  const { data } = await api.POST('/api/v1/usuarios', { body: datos });
  return datosDe(data);
}

export async function actualizarUsuario(
  idUsuario: number,
  cambios: ActualizarUsuario,
): Promise<UsuarioAdmin> {
  const { data } = await api.PATCH('/api/v1/usuarios/{id}', {
    params: { path: { id: idUsuario } },
    body: cambios,
  });
  return datosDe(data);
}

/** A-07: desactivar corta sus sesiones de inmediato (sube su versión de sesión). */
export async function cambiarEstadoUsuario(
  idUsuario: number,
  accion: AccionUsuario,
): Promise<UsuarioAdmin> {
  const params = { path: { id: idUsuario } };
  const { data } =
    accion === 'activar'
      ? await api.POST('/api/v1/usuarios/{id}/activar', { params })
      : await api.POST('/api/v1/usuarios/{id}/desactivar', { params });
  return datosDe(data);
}
