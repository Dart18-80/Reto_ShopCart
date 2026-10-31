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

    // PATCH: lo que no llega se conserva. El SP vuelve a comprobar que la dirección es del cliente.
    async actualizar(idDireccion: number, cambios: ActualizarDireccion): Promise<Direccion> {
      const actual = await obtener(idDireccion);
      return repositorio.actualizar(idDireccion, {
        alias: cambios.alias === undefined ? actual.alias : cambios.alias,
        nombreRecibe: cambios.nombreRecibe ?? actual.nombreRecibe,
        telefonoRecibe: cambios.telefonoRecibe ?? actual.telefonoRecibe,
        idMunicipio: cambios.idMunicipio ?? actual.municipio.idMunicipio,
        direccionLinea: cambios.direccionLinea ?? actual.direccionLinea,
        referencia: cambios.referencia === undefined ? actual.referencia : cambios.referencia,
        esPredeterminada: cambios.esPredeterminada ?? actual.esPredeterminada,
      });
    },

    eliminar: (idDireccion: number): Promise<void> => repositorio.eliminar(idDireccion),

    listarDepartamentos: (): Promise<Departamento[]> => repositorio.listarDepartamentos(),

    listarMunicipios: (idDepartamento: number): Promise<Municipio[]> =>
      repositorio.listarMunicipios(idDepartamento),
  };
}

export type DireccionesService = ReturnType<typeof crearDireccionesService>;
