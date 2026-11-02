import sql from 'mssql';
import { ejecutarSPConjuntos, type NombreSP, type ParametrosSP } from '../../shared/db/index.js';
import { aMonto } from '../../shared/dinero/index.js';
import type { Pedido } from './pedidos.types.js';

interface FilaPedido {
  IDPedido: number;
  NumeroPedido: string;
  Estado: string;
  Subtotal: number;
  Descuento: number;
  CostoEnvio: number;
  Total: number;
  BaseImponible: number;
  IVA: number;
  CodigoCupon: string | null;
  NombreMetodoEnvio: string;
  FechaEstimadaEntrega: Date;
  FechaPago: Date;
  FechaPagoLocal: Date;
  MarcaTarjeta: string;
  UltimosDigitos: string;
  NombreRecibe: string;
  TelefonoRecibe: string;
  Departamento: string;
  Municipio: string;
  DireccionLinea: string;
  Referencia: string | null;
}

interface FilaLineaPedido {
  IDVariante: number;
  SKU: string;
  NombreProducto: string;
  DescripcionVariante: string;
  NombreCategoria: string;
  Cantidad: number;
  PrecioUnitario: number;
  DescuentoLinea: number;
  TotalLinea: number;
}

// El driver entrega un DATE como la medianoche UTC de ese día.
const LARGO_FECHA = 10;
const aFecha = (fecha: Date): string => fecha.toISOString().slice(0, LARGO_FECHA);

const aPedido = (fila: FilaPedido, lineas: FilaLineaPedido[]): Pedido => ({
  idPedido: fila.IDPedido,
  numeroPedido: fila.NumeroPedido,
  estado: fila.Estado,
  subtotal: aMonto(fila.Subtotal),
  descuento: aMonto(fila.Descuento),
  costoEnvio: aMonto(fila.CostoEnvio),
  total: aMonto(fila.Total),
  baseImponible: aMonto(fila.BaseImponible),
  iva: aMonto(fila.IVA),
  codigoCupon: fila.CodigoCupon,
  envio: {
    nombre: fila.NombreMetodoEnvio,
    fechaEstimadaEntrega: aFecha(fila.FechaEstimadaEntrega),
  },
  fechaPago: fila.FechaPago,
  fechaPagoLocal: aFecha(fila.FechaPagoLocal),
  tarjeta: { marca: fila.MarcaTarjeta, ultimosDigitos: fila.UltimosDigitos },
  direccion: {
    nombreRecibe: fila.NombreRecibe,
    telefonoRecibe: fila.TelefonoRecibe,
    departamento: fila.Departamento,
    municipio: fila.Municipio,
    direccionLinea: fila.DireccionLinea,
    referencia: fila.Referencia,
  },
  lineas: lineas.map((linea) => ({
    idVariante: linea.IDVariante,
    sku: linea.SKU,
    producto: linea.NombreProducto,
    descripcionVariante: linea.DescripcionVariante,
    categoria: linea.NombreCategoria,
    cantidad: linea.Cantidad,
    precioUnitario: aMonto(linea.PrecioUnitario),
    descuentoLinea: aMonto(linea.DescuentoLinea),
    totalLinea: aMonto(linea.TotalLinea),
  })),
});

async function pedidoDe(nombre: NombreSP, parametros: ParametrosSP): Promise<Pedido | null> {
  const [pedidos, lineas] = await ejecutarSPConjuntos<[FilaPedido[], FilaLineaPedido[]]>(
    nombre,
    parametros,
  );
  const pedido = pedidos?.[0];
  if (pedido === undefined) return null;
  if (lineas === undefined) throw new Error(`${nombre} devolvió un pedido sin detalle`);
  return aPedido(pedido, lineas);
}

export const pedidosRepository = {
  /** RF-06: la transacción atómica que crea el pedido del intento autorizado (idempotente por sesión). */
  async crearDeIntento(idIntentoPago: number, tokenArrendamiento: string): Promise<Pedido> {
    const pedido = await pedidoDe('SP_Pedidos_CrearPedido', {
      IDIntentoPago: { tipo: sql.BigInt, valor: idIntentoPago },
      TokenArrendamiento: { tipo: sql.UniqueIdentifier, valor: tokenArrendamiento },
    });
    if (pedido === null) throw new Error('SP_Pedidos_CrearPedido no devolvió el pedido');
    return pedido;
  },

  /** N-03: el pedido creado con ese intento; null si no hay (o si es de otro cliente, RF-01). */
  obtenerDeIntento(idIntentoPago: number): Promise<Pedido | null> {
    return pedidoDe('SP_Pedidos_ObtenerDeIntento', {
      IDIntentoPago: { tipo: sql.BigInt, valor: idIntentoPago },
    });
  },

  /** RF-01: null si no existe o si es de otro cliente. */
  obtener(idPedido: number): Promise<Pedido | null> {
    return pedidoDe('SP_Pedidos_ObtenerDetalle', { IDPedido: { tipo: sql.Int, valor: idPedido } });
  },
};

export type PedidosRepository = typeof pedidosRepository;
