import type { PaginaSP } from '../../shared/db/index.js';
import type { BitacoraRepository } from './bitacora.repository.js';
import type { ConsultaBitacora } from './bitacora.schemas.js';
import type { RegistroBitacora } from './bitacora.types.js';

interface Dependencias {
  repositorio: BitacoraRepository;
}

// RF-09 (E7-H02): consulta de la bitácora. El SP valida el rango y el rol; la Fase 5 pondrá aquí la caché (A-11).
export function crearBitacoraService({ repositorio }: Dependencias) {
  return {
    listar: (consulta: ConsultaBitacora): Promise<PaginaSP<RegistroBitacora>> =>
      repositorio.listar(consulta),
  };
}

export type BitacoraService = ReturnType<typeof crearBitacoraService>;
