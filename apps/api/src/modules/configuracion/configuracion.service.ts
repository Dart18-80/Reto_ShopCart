import type { ConfiguracionRepository } from './configuracion.repository.js';
import type { ActualizarConfiguracion } from './configuracion.schemas.js';
import type { Configuracion } from './configuracion.types.js';

interface Dependencias {
  repositorio: ConfiguracionRepository;
}

export function crearConfiguracionService({ repositorio }: Dependencias) {
  return {
    obtener: (): Promise<Configuracion> => repositorio.obtener(),

    // RF-09: la bitácora del cambio la escribe el trigger con el actor y el RequestId (A-18).
    actualizar: (cambios: ActualizarConfiguracion): Promise<Configuracion> =>
      repositorio.actualizar(cambios),
  };
}

export type ConfiguracionService = ReturnType<typeof crearConfiguracionService>;
