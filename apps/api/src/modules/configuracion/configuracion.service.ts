import type { InvalidadorReportes } from '../reportes/index.js';
import type { ConfiguracionRepository } from './configuracion.repository.js';
import type { ActualizarConfiguracion } from './configuracion.schemas.js';
import type { Configuracion } from './configuracion.types.js';

interface Dependencias {
  repositorio: ConfiguracionRepository;
  /** A-11: HorasCarritoAbandonado define qué carritos cuentan como abandonados. */
  reportes: InvalidadorReportes;
}

export function crearConfiguracionService({ repositorio, reportes }: Dependencias) {
  return {
    obtener: (): Promise<Configuracion> => repositorio.obtener(),

    // RF-09: la bitácora del cambio la escribe el trigger con el actor y el RequestId (A-18).
    actualizar: (cambios: ActualizarConfiguracion): Promise<Configuracion> =>
      reportes.tras(repositorio.actualizar(cambios)),
  };
}

export type ConfiguracionService = ReturnType<typeof crearConfiguracionService>;
