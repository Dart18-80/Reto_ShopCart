import sql from 'mssql';
import {
  ejecutarSP,
  ejecutarSPConjuntos,
  ejecutarSPPaginado,
  type NombreSP,
  type PaginaSP,
  type ParametrosSP,
} from '../../shared/db/index.js';
import { aMonto } from '../../shared/dinero/index.js';
import type { CambiarEstado, ListarPedidosGestion } from './pedidos.schemas.js';
import type {
  CambioDeEstado,
  Pedido,
  ResumenPedido,
  ResumenPedidoGestion,
} from './pedidos.types.js';

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
  MontoReembolsado: number;
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
  IDDetallePedido: number;
  IDVariante: number;
  SKU: string;
  NombreProducto: string;
  DescripcionVariante: string;
  NombreCategoria: string;
  Cantidad: number;
  CantidadDevuelta: number;
  PrecioUnitario: number;
  DescuentoLinea: number;
  TotalLinea: number;
}

interface FilaHistorial {
  CodigoEstadoAnterior: string | null;
  CodigoEstadoNuevo: string;
  RolUsuario: string;
  Motivo: string | null;
  Fecha: Date;
}

interface FilaResumen {
  IDPedido: number;
  NumeroPedido: string;
  Estado: string;
  Total: number;
  Articulos: number;
  FechaPago: Date;
  FechaPagoLocal: Date;
}

interface FilaResumenGestion extends FilaResumen {
  IDCliente: number;
  NombreCliente: string;
  CorreoCliente: string;
}

// El driver entrega un DATE como la medianoche UTC de ese día.
const LARGO_FECHA = 10;
const aFecha = (fecha: Date): string => fecha.toISOString().slice(0, LARGO_FECHA);

const aCambio = (fila: FilaHistorial): CambioDeEstado => ({
  estadoAnterior: fila.CodigoEstadoAnterior,
  estadoNuevo: fila.CodigoEstadoNuevo,
  rol: fila.RolUsuario,
  motivo: fila.Motivo,
  fecha: fila.Fecha,
});

const aResumen = (fila: FilaResumen): ResumenPedido => ({
  idPedido: fila.IDPedido,
  numeroPedido: fila.NumeroPedido,
  estado: fila.Estado,
  total: aMonto(fila.Total),
  articulos: fila.Articulos,
  fechaPago: fila.FechaPago,
  fechaPagoLocal: aFecha(fila.FechaPagoLocal),
});

const aResumenGestion = (fila: FilaResumenGestion): ResumenPedidoGestion => ({
  ...aResumen(fila),
  cliente: { idUsuario: fila.IDCliente, nombre: fila.NombreCliente, correo: fila.CorreoCliente },
});

const aPedido = (
  fila: FilaPedido,
  lineas: FilaLineaPedido[],
  historial: FilaHistorial[],
): Pedido => ({
  idPedido: fila.IDPedido,
  numeroPedido: fila.NumeroPedido,
  estado: fila.Estado,
  subtotal: aMonto(fila.Subtotal),
  descuento: aMonto(fila.Descuento),
  costoEnvio: aMonto(fila.CostoEnvio),
  total: aMonto(fila.Total),
  baseImponible: aMonto(fila.BaseImponible),
  iva: aMonto(fila.IVA),
  montoReembolsado: aMonto(fila.MontoReembolsado),
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
    idDetallePedido: linea.IDDetallePedido,
    idVariante: linea.IDVariante,
    sku: linea.SKU,
    producto: linea.NombreProducto,
    descripcionVariante: linea.DescripcionVariante,
    categoria: linea.NombreCategoria,
    cantidad: linea.Cantidad,
    cantidadDevuelta: linea.CantidadDevuelta,
    precioUnitario: aMonto(linea.PrecioUnitario),
    descuentoLinea: aMonto(linea.DescuentoLinea),
    totalLinea: aMonto(linea.TotalLinea),
  })),
  historial: historial.map(aCambio),
});

async function pedidoDe(nombre: NombreSP, parametros: ParametrosSP): Promise<Pedido | null> {
  const [pedidos, lineas, historial] = await ejecutarSPConjuntos<
    [FilaPedido[], FilaLineaPedido[], FilaHistorial[]]
  >(nombre, parametros);
  const pedido = pedidos?.[0];
  if (pedido === undefined) return null;
  if (lineas === undefined || historial === undefined) {
    throw new Error(`${nombre} devolvió un pedido sin detalle o sin historial`);
  }
  return aPedido(pedido, lineas, historial);
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

  /** RF-01: los del cliente de la petición (@IDUsuarioActor). */
  async listarPropios(pagina: number, tamano: number): Promise<PaginaSP<ResumenPedido>> {
    const { filas, total } = await ejecutarSPPaginado<FilaResumen>('SP_Pedidos_ListarPropios', {
      Pagina: { tipo: sql.Int, valor: pagina },
      Tamano: { tipo: sql.Int, valor: tamano },
    });
    return { filas: filas.map(aResumen), total };
  },

  async listarGestion(filtros: ListarPedidosGestion): Promise<PaginaSP<ResumenPedidoGestion>> {
    const { filas, total } = await ejecutarSPPaginado<FilaResumenGestion>('SP_Pedidos_Listar', {
      Estado: { tipo: sql.VarChar(20), valor: filtros.estado ?? null },
      IDClienteFiltro: { tipo: sql.Int, valor: filtros.idCliente ?? null },
      Desde: { tipo: sql.Date, valor: filtros.desde ?? null },
      Hasta: { tipo: sql.Date, valor: filtros.hasta ?? null },
      Pagina: { tipo: sql.Int, valor: filtros.pagina },
      Tamano: { tipo: sql.Int, valor: filtros.tamano },
    });
    return { filas: filas.map(aResumenGestion), total };
  },

  /** N-08: el SP valida la transición, el rol y el estado esperado bajo bloqueo. */
  async cambiarEstado(idPedido: number, cambio: CambiarEstado): Promise<Pedido> {
    const pedido = await pedidoDe('SP_Pedidos_CambiarEstado', {
      IDPedido: { tipo: sql.Int, valor: idPedido },
      EstadoEsperado: { tipo: sql.VarChar(20), valor: cambio.estadoEsperado },
      EstadoNuevo: { tipo: sql.VarChar(20), valor: cambio.estadoNuevo },
      Motivo: { tipo: sql.NVarChar(250), valor: cambio.motivo ?? null },
    });
    if (pedido === null) throw new Error('SP_Pedidos_CambiarEstado no devolvió el pedido');
    return pedido;
  },

  /** N-08: la tabla de transiciones (la prueba de coincidencia con el mapa del servicio). */
  listarTransiciones(): Promise<{ Origen: string; Destino: string; Rol: string }[]> {
    return ejecutarSP('SP_Pedidos_ListarTransiciones');
  },

  /** RF-01: null si no existe o si es de otro cliente. */
  obtener(idPedido: number): Promise<Pedido | null> {
    return pedidoDe('SP_Pedidos_ObtenerDetalle', { IDPedido: { tipo: sql.Int, valor: idPedido } });
  },
};

export type PedidosRepository = typeof pedidosRepository;
