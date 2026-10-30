import { ejecutarSP } from '../../shared/db/index.js';
import type { ServidorBaseDatos } from './sistema.types.js';

interface FilaHealth {
  VersionServidor: string;
  FechaHoraUtc: Date;
}

export const sistemaRepository = {
  async health(): Promise<ServidorBaseDatos> {
    const [fila] = await ejecutarSP<FilaHealth>('SP_Sistema_Health');
    if (fila === undefined) throw new Error('SP_Sistema_Health no devolvió filas');
    return { versionServidor: fila.VersionServidor, fechaHoraUtc: fila.FechaHoraUtc };
  },
};

export type SistemaRepository = typeof sistemaRepository;
