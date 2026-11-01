import sql from 'mssql';
import { bigintANumero, ejecutarSP, ejecutarSPPaginado } from '../../shared/db/index.js';
import type { RegistrarAjuste, RegistrarEntrada } from './inventario.schemas.js';
import type {
  Descuadre,
  Existencia,
  ExistenciaBodega,
  Movimiento,
  Pagina,
  TipoMovimiento,
} from './inventario.types.js';

interface FilaMovimiento {
  // BIGINT: el driver lo entrega como texto.
  IDMovimientoKardex: string;
  IDVariante: number;
  Tipo: TipoMovimiento;
  Signo: number;
  Cantidad: number;
  ExistenciaAnterior: number;
  ExistenciaResultante: number;
  Motivo: string;
  Referencia: string | null;
  IDPedido: number | null;
  IDDevolucion: number | null;
  IDUsuario: number;
  Usuario: string;
  Fecha: Date;
}

interface FilaExistencia {
  IDVariante: number;
  SKU: string;
  IDProducto: number;
  Producto: string;
  DescripcionAtributos: string;
  Activo: boolean;
  ExistenciaFisica: number;
  Reservado: number;
  Disponible: number;
}

interface FilaDescuadre {
  IDVariante: number;
  SKU: string;
  ExistenciaFisica: number;
  SumaKardex: number;
  ExistenciaUltimoMovimiento: number | null;
}

interface FilaBodega {
  IDVariante: number;
  SKU: string;
  ExistenciaFisica: number;
  UnidadesPorDespachar: number;
  ExistenciaBodega: number;
}

const aMovimiento = (fila: FilaMovimiento): Movimiento => ({
  idMovimientoKardex: bigintANumero(fila.IDMovimientoKardex, 'IDMovimientoKardex'),
  idVariante: fila.IDVariante,
  tipo: fila.Tipo,
  signo: fila.Signo,
  cantidad: fila.Cantidad,
  existenciaAnterior: fila.ExistenciaAnterior,
  existenciaResultante: fila.ExistenciaResultante,
  motivo: fila.Motivo,
  referencia: fila.Referencia,
  idPedido: fila.IDPedido,
  idDevolucion: fila.IDDevolucion,
  usuario: { idUsuario: fila.IDUsuario, nombre: fila.Usuario },
  fecha: fila.Fecha,
});

function unico(filas: FilaMovimiento[], sp: string): Movimiento {
  const [fila] = filas;
  if (fila === undefined) throw new Error(`${sp} no devolvió el movimiento`);
  return aMovimiento(fila);
}

// MOTIVO_REQUERIDO lo decide el SP: un motivo ausente o en blanco le llega como NULL.
const motivo = (texto: string | undefined) => ({
  tipo: sql.NVarChar(250),
  valor: texto === undefined || texto.trim() === '' ? null : texto,
});

const paginacion = ({ pagina, tamano }: Pagina) => ({
  Pagina: { tipo: sql.Int, valor: pagina },
  Tamano: { tipo: sql.Int, valor: tamano },
});

export const inventarioRepository = {
  async registrarEntrada(datos: RegistrarEntrada): Promise<Movimiento> {
    const filas = await ejecutarSP<FilaMovimiento>('SP_Inventario_RegistrarEntrada', {
      IDVariante: { tipo: sql.Int, valor: datos.idVariante },
      Cantidad: { tipo: sql.Int, valor: datos.cantidad },
      Motivo: motivo(datos.motivo),
      Referencia: { tipo: sql.NVarChar(100), valor: datos.referencia ?? null },
    });
    return unico(filas, 'SP_Inventario_RegistrarEntrada');
  },

  async registrarAjuste(datos: RegistrarAjuste): Promise<Movimiento> {
    const filas = await ejecutarSP<FilaMovimiento>('SP_Inventario_RegistrarAjuste', {
      IDVariante: { tipo: sql.Int, valor: datos.idVariante },
      Cantidad: { tipo: sql.Int, valor: datos.cantidad },
      Motivo: motivo(datos.motivo),
    });
    return unico(filas, 'SP_Inventario_RegistrarAjuste');
  },

  async obtenerKardex(
    idVariante: number,
    pagina: Pagina,
  ): Promise<{ movimientos: Movimiento[]; total: number }> {
    const { filas, total } = await ejecutarSPPaginado<FilaMovimiento>(
      'SP_Inventario_ObtenerKardex',
      {
        IDVariante: { tipo: sql.Int, valor: idVariante },
        ...paginacion(pagina),
      },
    );
    return { movimientos: filas.map(aMovimiento), total };
  },

  async listarExistencias(
    idVariante: number | null,
    pagina: Pagina,
  ): Promise<{ existencias: Existencia[]; total: number }> {
    const { filas, total } = await ejecutarSPPaginado<FilaExistencia>(
      'SP_Inventario_ListarExistencias',
      {
        IDVariante: { tipo: sql.Int, valor: idVariante },
        ...paginacion(pagina),
      },
    );
    const existencias = filas.map((fila): Existencia => ({
      idVariante: fila.IDVariante,
      sku: fila.SKU,
      idProducto: fila.IDProducto,
      producto: fila.Producto,
      descripcionAtributos: fila.DescripcionAtributos,
      activo: fila.Activo,
      existenciaFisica: fila.ExistenciaFisica,
      reservado: fila.Reservado,
      disponible: fila.Disponible,
    }));
    return { existencias, total };
  },

  async conciliar(): Promise<Descuadre[]> {
    const filas = await ejecutarSP<FilaDescuadre>('SP_Inventario_Conciliar');
    return filas.map((fila) => ({
      idVariante: fila.IDVariante,
      sku: fila.SKU,
      existenciaFisica: fila.ExistenciaFisica,
      sumaKardex: fila.SumaKardex,
      existenciaUltimoMovimiento: fila.ExistenciaUltimoMovimiento,
    }));
  },

  async listarExistenciaBodega(
    idVariante: number | null,
    pagina: Pagina,
  ): Promise<{ existencias: ExistenciaBodega[]; total: number }> {
    const { filas, total } = await ejecutarSPPaginado<FilaBodega>(
      'SP_Inventario_ListarExistenciaBodega',
      {
        IDVariante: { tipo: sql.Int, valor: idVariante },
        ...paginacion(pagina),
      },
    );
    const existencias = filas.map((fila): ExistenciaBodega => ({
      idVariante: fila.IDVariante,
      sku: fila.SKU,
      existenciaFisica: fila.ExistenciaFisica,
      unidadesPorDespachar: fila.UnidadesPorDespachar,
      existenciaBodega: fila.ExistenciaBodega,
    }));
    return { existencias, total };
  },
};

export type InventarioRepository = typeof inventarioRepository;
