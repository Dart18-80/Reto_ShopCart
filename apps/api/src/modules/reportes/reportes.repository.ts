import sql from 'mssql';
import {
  ejecutarSP,
  ejecutarSPPaginado,
  type PaginaSP,
  type ParametrosSP,
} from '../../shared/db/index.js';
import { aMonto } from '../../shared/dinero/index.js';
import type { ConsultaCarritos, ConsultaRango, ConsultaVentas } from './reportes.schemas.js';
import type {
  CarritoAbandonado,
  ProductoVendido,
  Resumen,
  VentasDeCategoria,
  VentasDelPeriodo,
} from './reportes.types.js';

interface FilaResumen {
  Desde: Date;
  Hasta: Date;
  Ventas: number;
  Pedidos: number;
  TicketPromedio: number;
  Unidades: number;
  Devoluciones: number;
  Envio: number;
  CarritosAbandonados: number;
  MontoPotencialPerdido: number;
}

interface FilaCarrito {
  IDCarrito: number;
  IDCliente: number | null;
  NombreCliente: string | null;
  FechaUltimaActividad: Date;
  Lineas: number;
  Unidades: number;
  MontoPotencial: number;
}

// El driver entrega un DATE como la medianoche UTC de ese día.
const LARGO_FECHA = 10;
const aFecha = (fecha: Date): string => fecha.toISOString().slice(0, LARGO_FECHA);

const rango = ({ desde, hasta }: ConsultaRango): ParametrosSP => ({
  Desde: { tipo: sql.Date, valor: desde ?? null },
  Hasta: { tipo: sql.Date, valor: hasta ?? null },
});

const aCarrito = (fila: FilaCarrito): CarritoAbandonado => ({
  idCarrito: fila.IDCarrito,
  cliente:
    fila.IDCliente === null || fila.NombreCliente === null
      ? null
      : { idUsuario: fila.IDCliente, nombre: fila.NombreCliente },
  fechaUltimaActividad: fila.FechaUltimaActividad,
  lineas: fila.Lineas,
  unidades: fila.Unidades,
  montoPotencial: aMonto(fila.MontoPotencial),
});

// RF-08: todos los reportes agregan sobre VW_Dashboard_HechosVenta (M-07); aquí solo se mapean.
export const reportesRepository = {
  async resumen(consulta: ConsultaRango): Promise<Resumen> {
    const [fila] = await ejecutarSP<FilaResumen>('SP_Dashboard_Resumen', rango(consulta));
    if (fila === undefined) throw new Error('SP_Dashboard_Resumen no devolvió el resumen');
    return {
      desde: aFecha(fila.Desde),
      hasta: aFecha(fila.Hasta),
      ventas: aMonto(fila.Ventas),
      pedidos: fila.Pedidos,
      ticketPromedio: aMonto(fila.TicketPromedio),
      unidades: fila.Unidades,
      devoluciones: aMonto(fila.Devoluciones),
      envio: aMonto(fila.Envio),
      carritosAbandonados: fila.CarritosAbandonados,
      montoPotencialPerdido: aMonto(fila.MontoPotencialPerdido),
    };
  },

  async ventasPorPeriodo(consulta: ConsultaVentas): Promise<VentasDelPeriodo[]> {
    const filas = await ejecutarSP<{ Periodo: Date; Ventas: number; Pedidos: number }>(
      'SP_Dashboard_VentasPorPeriodo',
      { ...rango(consulta), Agrupacion: { tipo: sql.VarChar(6), valor: consulta.agrupacion } },
    );
    return filas.map((f) => ({
      periodo: aFecha(f.Periodo),
      ventas: aMonto(f.Ventas),
      pedidos: f.Pedidos,
    }));
  },

  async ventasPorCategoria(consulta: ConsultaRango): Promise<VentasDeCategoria[]> {
    const filas = await ejecutarSP<{
      IDCategoria: number;
      Categoria: string;
      Unidades: number;
      Ventas: number;
    }>('SP_Dashboard_VentasPorCategoria', rango(consulta));
    return filas.map((f) => ({
      idCategoria: f.IDCategoria,
      categoria: f.Categoria,
      unidades: f.Unidades,
      ventas: aMonto(f.Ventas),
    }));
  },

  async topProductos(consulta: ConsultaRango): Promise<ProductoVendido[]> {
    const filas = await ejecutarSP<{
      IDProducto: number;
      Producto: string;
      Unidades: number;
      Ventas: number;
    }>('SP_Dashboard_TopProductos', rango(consulta));
    return filas.map((f) => ({
      idProducto: f.IDProducto,
      producto: f.Producto,
      unidades: f.Unidades,
      ventas: aMonto(f.Ventas),
    }));
  },

  async carritosAbandonados(consulta: ConsultaCarritos): Promise<PaginaSP<CarritoAbandonado>> {
    const { filas, total } = await ejecutarSPPaginado<FilaCarrito>(
      'SP_Dashboard_CarritosAbandonados',
      {
        ...rango(consulta),
        Pagina: { tipo: sql.Int, valor: consulta.pagina },
        Tamano: { tipo: sql.Int, valor: consulta.tamano },
        Orden: { tipo: sql.VarChar(20), valor: consulta.orden },
        Direccion: { tipo: sql.VarChar(4), valor: consulta.direccion },
      },
    );
    return { filas: filas.map(aCarrito), total };
  },
};

export type ReportesRepository = typeof reportesRepository;
