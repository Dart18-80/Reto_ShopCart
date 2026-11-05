import type { ActualizarDireccion, CrearDireccion } from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type Direccion = Respuesta<'/api/v1/direcciones', 'get'>['datos'][number];
export type Departamento = Respuesta<'/api/v1/departamentos', 'get'>['datos'][number];
export type Municipio = Respuesta<'/api/v1/departamentos/{id}/municipios', 'get'>['datos'][number];

// El middleware de errores ya convirtió toda respuesta de error en ErrorApi: un 2xx sin cuerpo es inesperado.
function datosDe<D>(data: { datos: D } | undefined): D {
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

// RF-01: las direcciones son del Cliente del token; nunca se envía su ID.

export async function listarDirecciones(): Promise<Direccion[]> {
  const { data } = await api.GET('/api/v1/direcciones');
  return datosDe(data);
}

export async function crearDireccion(direccion: CrearDireccion): Promise<Direccion> {
  const { data } = await api.POST('/api/v1/direcciones', { body: direccion });
  return datosDe(data);
}

export async function actualizarDireccion(
  idDireccion: number,
  cambios: ActualizarDireccion,
): Promise<Direccion> {
  const { data } = await api.PATCH('/api/v1/direcciones/{id}', {
    params: { path: { id: idDireccion } },
    body: cambios,
  });
  return datosDe(data);
}

export async function eliminarDireccion(idDireccion: number): Promise<void> {
  await api.DELETE('/api/v1/direcciones/{id}', { params: { path: { id: idDireccion } } });
}

export async function listarDepartamentos(): Promise<Departamento[]> {
  const { data } = await api.GET('/api/v1/departamentos');
  return datosDe(data);
}

export async function listarMunicipios(idDepartamento: number): Promise<Municipio[]> {
  const { data } = await api.GET('/api/v1/departamentos/{id}/municipios', {
    params: { path: { id: idDepartamento } },
  });
  return datosDe(data);
}
