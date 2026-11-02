import sql from 'mssql';
import { z } from '../../shared/openapi/zod.js';
import {
  ejecutarSP,
  ejecutarSPConjuntos,
  ejecutarSPPaginado,
  type PaginaSP,
} from '../../shared/db/index.js';
import type {
  EstadoExportacion,
  Exportacion,
  ExportacionSolicitada,
  ExportacionTomada,
  Formato,
  ReporteExportable,
} from './exportaciones.types.js';

interface FilaExportacion {
  IDSolicitudExportacion: number;
  Reporte: ReporteExportable;
  Formato: Formato;
  Filtros: string;
  Estado: EstadoExportacion;
  Intentos: number;
  UltimoError: string | null;
  ReferenciaArchivo: string | null;
  TamanoBytes: number | null;
  FechaCreacion: Date;
  FechaFinalizacion: Date | null;
  FechaExpiracion: Date | null;
}

interface FilaTomada {
  IDSolicitudExportacion: number;
  IDUsuario: number;
  Reporte: ReporteExportable;
  Formato: Formato;
  Filtros: string;
  Intentos: number;
  TokenArrendamiento: string;
}

// La base guarda los filtros ya validados y normalizados (CK ISJSON): un objeto JSON.
const filtrosGuardados = z.record(z.string(), z.unknown());
const filtrosDe = (texto: string): Record<string, unknown> =>
  filtrosGuardados.parse(JSON.parse(texto));

const aExportacion = (f: FilaExportacion): Exportacion => ({
  idExportacion: f.IDSolicitudExportacion,
  reporte: f.Reporte,
  formato: f.Formato,
  filtros: filtrosDe(f.Filtros),
  estado: f.Estado,
  intentos: f.Intentos,
  error: f.UltimoError,
  referenciaArchivo: f.ReferenciaArchivo,
  tamanoBytes: f.TamanoBytes,
  fechaCreacion: f.FechaCreacion,
  fechaFinalizacion: f.FechaFinalizacion,
  fechaExpiracion: f.FechaExpiracion,
});

const arrendamiento = ({
  idExportacion,
  token,
}: Pick<ExportacionTomada, 'idExportacion' | 'token'>) => ({
  IDSolicitudExportacion: { tipo: sql.Int, valor: idExportacion },
  TokenArrendamiento: { tipo: sql.UniqueIdentifier, valor: token },
});

export const exportacionesRepository = {
  async solicitar(
    reporte: ReporteExportable,
    formato: Formato,
    filtros: string,
    hashFiltros: Buffer,
    maxPendientes: number,
  ): Promise<ExportacionSolicitada> {
    const [fila] = await ejecutarSP<FilaExportacion & { Nueva: boolean }>(
      'SP_Exportaciones_Solicitar',
      {
        Reporte: { tipo: sql.VarChar(30), valor: reporte },
        Formato: { tipo: sql.VarChar(5), valor: formato },
        Filtros: { tipo: sql.NVarChar(1000), valor: filtros },
        // BINARY(32): en mssql el tipo Binary no recibe largo; el SP declara el largo exacto.
        HashFiltros: { tipo: sql.Binary, valor: hashFiltros },
        MaxPendientes: { tipo: sql.Int, valor: maxPendientes },
      },
    );
    if (fila === undefined) throw new Error('SP_Exportaciones_Solicitar no devolvió la solicitud');
    return { exportacion: aExportacion(fila), nueva: fila.Nueva };
  },

  async obtener(idExportacion: number): Promise<Exportacion | null> {
    const [fila] = await ejecutarSP<FilaExportacion>('SP_Exportaciones_Obtener', {
      IDSolicitudExportacion: { tipo: sql.Int, valor: idExportacion },
    });
    return fila === undefined ? null : aExportacion(fila);
  },

  async listar(pagina: number, tamano: number): Promise<PaginaSP<Exportacion>> {
    const { filas, total } = await ejecutarSPPaginado<FilaExportacion>('SP_Exportaciones_Listar', {
      Pagina: { tipo: sql.Int, valor: pagina },
      Tamano: { tipo: sql.Int, valor: tamano },
    });
    return { filas: filas.map(aExportacion), total };
  },

  // Procesador (A-24): corre como Sistema, fuera de la petición.
  async tomar(
    segundosArrendamiento: number,
    maxIntentos: number,
  ): Promise<ExportacionTomada | null> {
    const [fila] = await ejecutarSP<FilaTomada>('SP_Exportaciones_Tomar', {
      SegundosArrendamiento: { tipo: sql.Int, valor: segundosArrendamiento },
      MaxIntentos: { tipo: sql.TinyInt, valor: maxIntentos },
    });
    if (fila === undefined) return null;
    return {
      idExportacion: fila.IDSolicitudExportacion,
      idUsuario: fila.IDUsuario,
      reporte: fila.Reporte,
      formato: fila.Formato,
      filtros: filtrosDe(fila.Filtros),
      intentos: fila.Intentos,
      token: fila.TokenArrendamiento,
    };
  },

  /** false si otra réplica retomó la exportación (el token ya no es el vigente). */
  async completar(
    tomada: ExportacionTomada,
    referenciaArchivo: string,
    tamanoBytes: number,
    horasVigencia: number,
  ): Promise<boolean> {
    const [fila] = await ejecutarSP<{ Aplicado: boolean }>('SP_Exportaciones_Completar', {
      ...arrendamiento(tomada),
      ReferenciaArchivo: { tipo: sql.VarChar(100), valor: referenciaArchivo },
      TamanoBytes: { tipo: sql.Int, valor: tamanoBytes },
      HorasVigencia: { tipo: sql.Int, valor: horasVigencia },
    });
    if (fila === undefined) throw new Error('SP_Exportaciones_Completar no devolvió el resultado');
    return fila.Aplicado;
  },

  async registrarFallo(
    tomada: ExportacionTomada,
    error: string,
    definitivo: boolean,
    maxIntentos: number,
  ): Promise<{ estado: EstadoExportacion; aplicado: boolean }> {
    const [fila] = await ejecutarSP<{ Estado: EstadoExportacion; Aplicado: boolean }>(
      'SP_Exportaciones_RegistrarFallo',
      {
        ...arrendamiento(tomada),
        Error: { tipo: sql.NVarChar(500), valor: error },
        Definitivo: { tipo: sql.Bit, valor: definitivo },
        MaxIntentos: { tipo: sql.TinyInt, valor: maxIntentos },
      },
    );
    if (fila === undefined)
      throw new Error('SP_Exportaciones_RegistrarFallo no devolvió el resultado');
    return { estado: fila.Estado, aplicado: fila.Aplicado };
  },

  /** Job (A-04). null si la otra réplica tenía el sp_getapplock. */
  async expirar(
    maximo: number,
  ): Promise<{ idExportacion: number; referenciaArchivo: string }[] | null> {
    const [ejecucion, archivos] = await ejecutarSPConjuntos<
      [{ Ejecutada: boolean }[], { IDSolicitudExportacion: number; ReferenciaArchivo: string }[]]
    >('SP_Exportaciones_Expirar', { Maximo: { tipo: sql.Int, valor: maximo } });
    const ejecutada = ejecucion?.[0]?.Ejecutada;
    if (ejecutada === undefined || archivos === undefined) {
      throw new Error('SP_Exportaciones_Expirar no devolvió sus dos conjuntos');
    }
    if (!ejecutada) return null;
    return archivos.map((a) => ({
      idExportacion: a.IDSolicitudExportacion,
      referenciaArchivo: a.ReferenciaArchivo,
    }));
  },

  /** De los nombres dados, los que alguna solicitud todavía referencia (A-22: la lista viaja como JSON). */
  async referenciasExistentes(nombres: string[]): Promise<Set<string>> {
    const filas = await ejecutarSP<{ ReferenciaArchivo: string }>(
      'SP_Exportaciones_ReferenciasExistentes',
      { Referencias: { tipo: sql.NVarChar(sql.MAX), valor: JSON.stringify(nombres) } },
    );
    return new Set(filas.map((f) => f.ReferenciaArchivo));
  },

  async quitarArchivo(idExportacion: number): Promise<void> {
    await ejecutarSP('SP_Exportaciones_QuitarArchivo', {
      IDSolicitudExportacion: { tipo: sql.Int, valor: idExportacion },
    });
  },
};

export type ExportacionesRepository = typeof exportacionesRepository;
