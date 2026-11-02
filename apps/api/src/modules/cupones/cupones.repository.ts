import sql from 'mssql';
import { ejecutarSP, ejecutarSPPaginado, type PaginaSP } from '../../shared/db/index.js';
import { aMonto } from '../../shared/dinero/index.js';
import type { ActualizarCupon, ListarCupones } from './cupones.schemas.js';
import type { Cupon, DatosCupon, TipoCupon } from './cupones.types.js';

interface FilaCupon {
  IDCupon: number;
  Codigo: string;
  Descripcion: string;
  Tipo: TipoCupon;
  Valor: number;
  MontoMaximoDescuento: number | null;
  MontoMinimoCompra: number;
  IDCategoria: number | null;
  Categoria: string | null;
  FechaInicio: Date;
  FechaFin: Date;
  LimiteUsosTotal: number;
  LimiteUsosPorCliente: number;
  UsosComprometidos: number;
  Usado: boolean;
  Activo: boolean;
}

const aCupon = (fila: FilaCupon): Cupon => ({
  idCupon: fila.IDCupon,
  codigo: fila.Codigo,
  descripcion: fila.Descripcion,
  tipo: fila.Tipo,
  valor: aMonto(fila.Valor),
  montoMaximoDescuento:
    fila.MontoMaximoDescuento === null ? null : aMonto(fila.MontoMaximoDescuento),
  montoMinimoCompra: aMonto(fila.MontoMinimoCompra),
  categoria:
    fila.IDCategoria === null || fila.Categoria === null
      ? null
      : { idCategoria: fila.IDCategoria, nombre: fila.Categoria },
  fechaInicio: fila.FechaInicio,
  fechaFin: fila.FechaFin,
  limiteUsosTotal: fila.LimiteUsosTotal,
  limiteUsosPorCliente: fila.LimiteUsosPorCliente,
  usosComprometidos: fila.UsosComprometidos,
  usado: fila.Usado,
  activo: fila.Activo,
});

function unico(filas: FilaCupon[], sp: string): Cupon {
  const [fila] = filas;
  if (fila === undefined) throw new Error(`${sp} no devolvió el cupón`);
  return aCupon(fila);
}

// Los largos y tipos son los mismos que declaran los SPs.
const MONTO = sql.Decimal(12, 2);
const FECHA = sql.DateTime2(3);

export const cuponesRepository = {
  async listar(filtros: ListarCupones): Promise<PaginaSP<Cupon>> {
    const { filas, total } = await ejecutarSPPaginado<FilaCupon>('SP_Cupones_Listar', {
      Activo: { tipo: sql.Bit, valor: filtros.activo ?? null },
      Pagina: { tipo: sql.Int, valor: filtros.pagina },
      Tamano: { tipo: sql.Int, valor: filtros.tamano },
    });
    return { filas: filas.map(aCupon), total };
  },

  /** null si no existe. */
  async obtener(idCupon: number): Promise<Cupon | null> {
    const [fila] = await ejecutarSP<FilaCupon>('SP_Cupones_Obtener', {
      IDCupon: { tipo: sql.Int, valor: idCupon },
    });
    return fila === undefined ? null : aCupon(fila);
  },

  async crear(datos: DatosCupon): Promise<Cupon> {
    const filas = await ejecutarSP<FilaCupon>('SP_Cupones_Crear', {
      Codigo: { tipo: sql.VarChar(30), valor: datos.codigo },
      Descripcion: { tipo: sql.NVarChar(200), valor: datos.descripcion },
      Tipo: { tipo: sql.VarChar(10), valor: datos.tipo },
      Valor: { tipo: MONTO, valor: datos.valor },
      MontoMaximoDescuento: { tipo: MONTO, valor: datos.montoMaximoDescuento },
      MontoMinimoCompra: { tipo: MONTO, valor: datos.montoMinimoCompra },
      IDCategoria: { tipo: sql.Int, valor: datos.idCategoria },
      FechaInicio: { tipo: FECHA, valor: datos.fechaInicio },
      FechaFin: { tipo: FECHA, valor: datos.fechaFin },
      LimiteUsosTotal: { tipo: sql.Int, valor: datos.limiteUsosTotal },
      LimiteUsosPorCliente: { tipo: sql.Int, valor: datos.limiteUsosPorCliente },
      Activo: { tipo: sql.Bit, valor: datos.activo },
    });
    return unico(filas, 'SP_Cupones_Crear');
  },

  // PATCH: un campo ausente va en NULL (sin cambio); null en el tope o la categoría los quita. El SP
  // mezcla con lo guardado bajo bloqueo.
  async actualizar(idCupon: number, cambios: ActualizarCupon): Promise<Cupon> {
    const filas = await ejecutarSP<FilaCupon>('SP_Cupones_Actualizar', {
      IDCupon: { tipo: sql.Int, valor: idCupon },
      Codigo: { tipo: sql.VarChar(30), valor: cambios.codigo ?? null },
      Descripcion: { tipo: sql.NVarChar(200), valor: cambios.descripcion ?? null },
      Tipo: { tipo: sql.VarChar(10), valor: cambios.tipo ?? null },
      Valor: { tipo: MONTO, valor: cambios.valor ?? null },
      MontoMaximoDescuento: { tipo: MONTO, valor: cambios.montoMaximoDescuento ?? null },
      QuitarMontoMaximoDescuento: { tipo: sql.Bit, valor: cambios.montoMaximoDescuento === null },
      MontoMinimoCompra: { tipo: MONTO, valor: cambios.montoMinimoCompra ?? null },
      IDCategoria: { tipo: sql.Int, valor: cambios.idCategoria ?? null },
      QuitarCategoria: { tipo: sql.Bit, valor: cambios.idCategoria === null },
      FechaInicio: { tipo: FECHA, valor: cambios.fechaInicio ?? null },
      FechaFin: { tipo: FECHA, valor: cambios.fechaFin ?? null },
      LimiteUsosTotal: { tipo: sql.Int, valor: cambios.limiteUsosTotal ?? null },
      LimiteUsosPorCliente: { tipo: sql.Int, valor: cambios.limiteUsosPorCliente ?? null },
    });
    return unico(filas, 'SP_Cupones_Actualizar');
  },

  async cambiarEstado(idCupon: number, activo: boolean): Promise<Cupon> {
    const filas = await ejecutarSP<FilaCupon>('SP_Cupones_CambiarEstado', {
      IDCupon: { tipo: sql.Int, valor: idCupon },
      Activo: { tipo: sql.Bit, valor: activo },
    });
    return unico(filas, 'SP_Cupones_CambiarEstado');
  },
};

export type CuponesRepository = typeof cuponesRepository;
