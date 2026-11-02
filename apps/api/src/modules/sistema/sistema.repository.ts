import sql from 'mssql';
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

  /** Job (A-04). null si la otra réplica tenía el sp_getapplock. */
  async purgarSolicitudesIdempotentes(horas: number): Promise<number | null> {
    const [fila] = await ejecutarSP<{ Ejecutada: boolean; SolicitudesPurgadas: number }>(
      'SP_Sistema_PurgarSolicitudesIdempotentes',
      { Horas: { tipo: sql.Int, valor: horas } },
    );
    if (fila === undefined)
      throw new Error('SP_Sistema_PurgarSolicitudesIdempotentes no devolvió el resultado');
    return fila.Ejecutada ? fila.SolicitudesPurgadas : null;
  },
};

export type SistemaRepository = typeof sistemaRepository;
