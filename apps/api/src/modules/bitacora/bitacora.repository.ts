import sql from 'mssql';
import { ejecutarSPPaginado, type PaginaSP } from '../../shared/db/index.js';
import type { ConsultaBitacora } from './bitacora.schemas.js';
import type { RegistroBitacora } from './bitacora.types.js';

interface FilaBitacora {
  IDBitacora: string | number;
  Modulo: string;
  Entidad: string;
  IDEntidad: string;
  Accion: string;
  ValorAnterior: string | null;
  ValorNuevo: string | null;
  IDUsuario: number | null;
  NombreUsuario: string | null;
  RequestId: string | null;
  Fecha: Date;
}

// CK_Bitacora_ValorAnterior/ValorNuevo garantizan que es JSON válido.
const aJson = (texto: string | null): unknown => (texto === null ? null : JSON.parse(texto));

const aRegistro = (fila: FilaBitacora): RegistroBitacora => ({
  idBitacora: String(fila.IDBitacora),
  modulo: fila.Modulo,
  entidad: fila.Entidad,
  idEntidad: fila.IDEntidad,
  accion: fila.Accion,
  valorAnterior: aJson(fila.ValorAnterior),
  valorNuevo: aJson(fila.ValorNuevo),
  usuario:
    fila.IDUsuario === null || fila.NombreUsuario === null
      ? null
      : { idUsuario: fila.IDUsuario, nombre: fila.NombreUsuario },
  requestId: fila.RequestId,
  fecha: fila.Fecha,
});

export const bitacoraRepository = {
  async listar(consulta: ConsultaBitacora): Promise<PaginaSP<RegistroBitacora>> {
    const { filas, total } = await ejecutarSPPaginado<FilaBitacora>('SP_Bitacora_Listar', {
      Modulo: { tipo: sql.VarChar(30), valor: consulta.modulo ?? null },
      Entidad: { tipo: sql.VarChar(50), valor: consulta.entidad ?? null },
      Desde: { tipo: sql.Date, valor: consulta.desde ?? null },
      Hasta: { tipo: sql.Date, valor: consulta.hasta ?? null },
      Pagina: { tipo: sql.Int, valor: consulta.pagina },
      Tamano: { tipo: sql.Int, valor: consulta.tamano },
      Orden: { tipo: sql.VarChar(20), valor: consulta.orden },
      Direccion: { tipo: sql.VarChar(4), valor: consulta.direccion },
    });
    return { filas: filas.map(aRegistro), total };
  },
};

export type BitacoraRepository = typeof bitacoraRepository;
