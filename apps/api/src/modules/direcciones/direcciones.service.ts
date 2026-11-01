import { AppError } from '../../shared/errors/index.js';
import type { DireccionesRepository } from './direcciones.repository.js';
import type { ActualizarDireccion, CrearDireccion } from './direcciones.schemas.js';
import type { Departamento, Direccion, Municipio } from './direcciones.types.js';

interface Dependencias {
  repositorio: DireccionesRepository;
}

export function crearDireccionesService({ repositorio }: Dependencias) {
  async function obtener(idDireccion: number): Promise<Direccion> {
    const direccion = await repositorio.obtenerPropia(idDireccion);
    // RF-01: una dirección ajena responde igual que una inexistente (404).
    if (direccion === null)
      throw new AppError('NO_ENCONTRADO', { mensaje: 'La dirección no existe.' });
    return direccion;
  }

  return {
    listar: (): Promise<Direccion[]> => repositorio.listarPropias(),

    obtener,

    crear: (datos: CrearDireccion): Promise<Direccion> =>
      repositorio.crear({
        alias: datos.alias ?? null,
        nombreRecibe: datos.nombreRecibe,
        telefonoRecibe: datos.telefonoRecibe,
        idMunicipio: datos.idMunicipio,
        direccionLinea: datos.direccionLinea,
        referencia: datos.referencia ?? null,
        esPredeterminada: datos.esPredeterminada,
      }),

    // PATCH: el SP mezcla los cambios con lo guardado bajo bloqueo y comprueba que la dirección es del
    // cliente (una ajena responde 404, RF-01).
    actualizar: (idDireccion: number, cambios: ActualizarDireccion): Promise<Direccion> =>
      repositorio.actualizar(idDireccion, cambios),

    eliminar: (idDireccion: number): Promise<void> => repositorio.eliminar(idDireccion),

    listarDepartamentos: (): Promise<Departamento[]> => repositorio.listarDepartamentos(),

    listarMunicipios: (idDepartamento: number): Promise<Municipio[]> =>
      repositorio.listarMunicipios(idDepartamento),
  };
}

export type DireccionesService = ReturnType<typeof crearDireccionesService>;
