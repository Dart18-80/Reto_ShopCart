import sql from 'mssql';
import {
  ejecutarSP,
  ejecutarSPConjuntos,
  ejecutarSPPaginado,
  type NombreSP,
  type PaginaSP,
  type ParametrosSP,
} from '../../shared/db/index.js';
import type { Decimal } from 'decimal.js';
import { aMonto } from '../../shared/dinero/index.js';
import type {
  CambiarEstado,
  ListarPagosEnRevision,
  ListarPedidosGestion,
  ListarReembolsos,
  RegistrarDevolucion,
  ResolverReembolso,
} from './pedidos.schemas.js';
import type {
  CambioDeEstado,
  EstadoPago,
  EstadoReembolso,
  PagoEnRevision,
  PagoParaResolver,
  PagoResuelto,
  Pedido,
  Reembolso,
  ReembolsoParaProcesar,
  ResolucionPago,
  ResultadoActualizacionReembolso,
  ResultadoReembolso,
  ResumenPedido,
  ResumenPedidoGestion,
} from './pedidos.types.js';

interface FilaPedido {
  IDPedido: number;
  NumeroPedido: string;
  Estado: string;
  EstadoPago: EstadoPago;
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
  EstadoPago: EstadoPago;
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

interface FilaReembolso {
  IDReembolso: number;
  IDPedido: number | null;
  NumeroPedido: string | null;
  IDIntentoPago: string | null;
  IDDevolucion: number | null;
  Origen: Reembolso['origen'];
  Monto: number;
  Estado: EstadoReembolso;
  Intentos: number;
  UltimoError: string | null;
  IDTransaccionReembolso: string | null;
  FechaProximoIntento: Date | null;
  FechaCompletado: Date | null;
  FechaCreacion: Date;
  MotivoResolucion: string | null;
  ReferenciaResolucion: string | null;
  FechaResolucion: Date | null;
}

// IDIntentoPago es BIGINT: el driver lo entrega como texto; los IDs caben de sobra en un number.
const aIdIntento = (id: string | number | null): number | null => (id === null ? null : Number(id));

interface FilaPagoEnRevision {
  IDIntentoPago: string;
  IDPedido: number | null;
  NumeroPedido: string | null;
  IDCliente: number;
  NombreCliente: string;
  CorreoCliente: string;
  Monto: number;
  IDTransaccionPasarela: string | null;
  MarcaTarjeta: string | null;
  UltimosDigitos: string | null;
  Causa: PagoEnRevision['causa'];
  Fecha: Date;
}

const aPagoEnRevision = (fila: FilaPagoEnRevision): PagoEnRevision => ({
  idIntentoPago: Number(fila.IDIntentoPago),
  idPedido: fila.IDPedido,
  numeroPedido: fila.NumeroPedido,
  cliente: { idUsuario: fila.IDCliente, nombre: fila.NombreCliente, correo: fila.CorreoCliente },
  monto: aMonto(fila.Monto),
  idTransaccion: fila.IDTransaccionPasarela,
  tarjeta: { marca: fila.MarcaTarjeta, ultimosDigitos: fila.UltimosDigitos },
  causa: fila.Causa,
  fecha: fila.Fecha,
});

interface FilaPagoResuelto {
  IDIntentoPago: string;
  Estado: PagoResuelto['estado'];
  ResolucionManual: ResolucionPago;
  MotivoResolucion: string;
  FechaResolucion: Date;
  IDPedido: number | null;
  IDReembolso: number | null;
}

interface FilaParaProcesar {
  IDReembolso: number;
  Origen: Reembolso['origen'];
  Monto: number;
  LlaveIdempotencia: string;
  TokenReclamo: string;
  IDTransaccionPasarela: string | null;
  LlaveIntento: string;
}

const aReembolso = (fila: FilaReembolso): Reembolso => ({
  idReembolso: fila.IDReembolso,
  idPedido: fila.IDPedido,
  numeroPedido: fila.NumeroPedido,
  idIntentoPago: aIdIntento(fila.IDIntentoPago),
  idDevolucion: fila.IDDevolucion,
  origen: fila.Origen,
  monto: aMonto(fila.Monto),
  estado: fila.Estado,
  intentos: fila.Intentos,
  ultimoError: fila.UltimoError,
  idTransaccionReembolso: fila.IDTransaccionReembolso,
  fechaProximoIntento: fila.FechaProximoIntento,
  fechaCompletado: fila.FechaCompletado,
  fechaCreacion: fila.FechaCreacion,
  motivoResolucion: fila.MotivoResolucion,
  referenciaResolucion: fila.ReferenciaResolucion,
  fechaResolucion: fila.FechaResolucion,
});

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
  estadoPago: fila.EstadoPago,
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
  estadoPago: fila.EstadoPago,
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

  /** N-09: la transacción de la cancelación; devuelve el reembolso Pendiente que dejó. */
  async cancelar(idPedido: number, motivo: string): Promise<number> {
    const [fila] = await ejecutarSP<{ IDReembolso: number | null }>('SP_Pedidos_Cancelar', {
      IDPedido: { tipo: sql.Int, valor: idPedido },
      Motivo: { tipo: sql.NVarChar(250), valor: motivo },
    });
    // Invariante: SP_Pedidos_Cancelar rechaza un pago EnRevision (50706) y solo SinCobro cancela con el intento
    // Anulado, así que siempre deja un reembolso.
    if (fila === undefined || fila.IDReembolso === null)
      throw new Error('SP_Pedidos_Cancelar no devolvió el reembolso');
    return fila.IDReembolso;
  },

  /** N-10: la transacción de la devolución; devuelve la devolución y su reembolso Pendiente. */
  async registrarDevolucion(
    idPedido: number,
    datos: RegistrarDevolucion,
  ): Promise<{ idDevolucion: number; idReembolso: number; montoReembolso: Decimal }> {
    const [fila] = await ejecutarSP<{
      IDDevolucion: number;
      IDReembolso: number;
      MontoReembolso: number;
    }>('SP_Pedidos_RegistrarDevolucion', {
      IDPedido: { tipo: sql.Int, valor: idPedido },
      Motivo: { tipo: sql.NVarChar(250), valor: datos.motivo },
      Lineas: { tipo: sql.NVarChar(sql.MAX), valor: JSON.stringify(datos.lineas) },
    });
    if (fila === undefined)
      throw new Error('SP_Pedidos_RegistrarDevolucion no devolvió la devolución');
    return {
      idDevolucion: fila.IDDevolucion,
      idReembolso: fila.IDReembolso,
      montoReembolso: aMonto(fila.MontoReembolso),
    };
  },

  /** null si no está Pendiente o ya lo tomó otro proceso. */
  async tomarReembolso(
    idReembolso: number,
    segundosReclamo: number,
  ): Promise<ReembolsoParaProcesar | null> {
    const [fila] = await ejecutarSP<FilaParaProcesar>('SP_Pedidos_TomarReembolso', {
      IDReembolso: { tipo: sql.Int, valor: idReembolso },
      SegundosReclamo: { tipo: sql.Int, valor: segundosReclamo },
    });
    if (fila === undefined) return null;
    return {
      idReembolso: fila.IDReembolso,
      origen: fila.Origen,
      monto: aMonto(fila.Monto),
      llave: fila.LlaveIdempotencia,
      tokenReclamo: fila.TokenReclamo,
      idTransaccion: fila.IDTransaccionPasarela,
      llaveIntento: fila.LlaveIntento,
    };
  },

  async actualizarReembolso(
    { idReembolso, tokenReclamo }: Pick<ReembolsoParaProcesar, 'idReembolso' | 'tokenReclamo'>,
    resultado: ResultadoReembolso,
    reglas: { maxIntentos: number; segundosEntreIntentos: number },
  ): Promise<ResultadoActualizacionReembolso> {
    const [fila] = await ejecutarSP<{ Estado: EstadoReembolso; Aplicado: boolean }>(
      'SP_Pedidos_ActualizarReembolso',
      {
        IDReembolso: { tipo: sql.Int, valor: idReembolso },
        Exito: { tipo: sql.Bit, valor: resultado.exito },
        IDTransaccionReembolso: {
          tipo: sql.VarChar(64),
          valor: resultado.exito ? resultado.idTransaccionReembolso : null,
        },
        Error: { tipo: sql.NVarChar(500), valor: resultado.exito ? null : resultado.error },
        TokenReclamo: { tipo: sql.UniqueIdentifier, valor: tokenReclamo },
        MaxIntentos: { tipo: sql.TinyInt, valor: reglas.maxIntentos },
        SegundosEntreIntentos: { tipo: sql.Int, valor: reglas.segundosEntreIntentos },
      },
    );
    if (fila === undefined)
      throw new Error('SP_Pedidos_ActualizarReembolso no devolvió el reembolso');
    return { estado: fila.Estado, aplicado: fila.Aplicado };
  },

  /** Job (A-04). null si la otra réplica tenía el sp_getapplock. */
  async obtenerReembolsosPendientes(maximo: number): Promise<number[] | null> {
    const [ejecucion, tomados] = await ejecutarSPConjuntos<
      [{ Ejecutada: boolean }[], { IDReembolso: number }[]]
    >('SP_Pedidos_ObtenerReembolsosPendientes', {
      Maximo: { tipo: sql.Int, valor: maximo },
    });
    const ejecutada = ejecucion?.[0]?.Ejecutada;
    if (ejecutada === undefined || tomados === undefined) {
      throw new Error('SP_Pedidos_ObtenerReembolsosPendientes no devolvió el resultado');
    }
    return ejecutada ? tomados.map((t) => t.IDReembolso) : null;
  },

  async listarReembolsos(filtros: ListarReembolsos): Promise<PaginaSP<Reembolso>> {
    const { filas, total } = await ejecutarSPPaginado<FilaReembolso>(
      'SP_Pedidos_ListarReembolsos',
      {
        Estado: { tipo: sql.VarChar(14), valor: filtros.estado ?? null },
        Pagina: { tipo: sql.Int, valor: filtros.pagina },
        Tamano: { tipo: sql.Int, valor: filtros.tamano },
      },
    );
    return { filas: filas.map(aReembolso), total };
  },

  /** E9-H04: los pagos EnRevision, los más recientes primero. */
  async listarPagosEnRevision(filtros: ListarPagosEnRevision): Promise<PaginaSP<PagoEnRevision>> {
    const { filas, total } = await ejecutarSPPaginado<FilaPagoEnRevision>(
      'SP_Pedidos_ListarPagosEnRevision',
      {
        Pagina: { tipo: sql.Int, valor: filtros.pagina },
        Tamano: { tipo: sql.Int, valor: filtros.tamano },
      },
    );
    return { filas: filas.map(aPagoEnRevision), total };
  },

  /** null si el intento no existe. */
  async obtenerPagoEnRevision(idIntentoPago: number): Promise<PagoParaResolver | null> {
    const [fila] = await ejecutarSP<{
      IDIntentoPago: string;
      LlaveIdempotencia: string;
      Estado: PagoParaResolver['estado'];
      IDPedido: number | null;
    }>('SP_Pedidos_ObtenerPagoEnRevision', {
      IDIntentoPago: { tipo: sql.BigInt, valor: idIntentoPago },
    });
    if (fila === undefined) return null;
    return {
      idIntentoPago: Number(fila.IDIntentoPago),
      llave: fila.LlaveIdempotencia,
      estado: fila.Estado,
      idPedido: fila.IDPedido,
    };
  },

  /** E9-H04: el SP vuelve a validar bajo bloqueo que siga EnRevision y que la resolución aplique. */
  async resolverPago(
    idIntentoPago: number,
    resolucion: ResolucionPago,
    motivo: string,
    idTransaccion: string | null,
  ): Promise<PagoResuelto> {
    const [fila] = await ejecutarSP<FilaPagoResuelto>('SP_Pedidos_ResolverPagoEnRevision', {
      IDIntentoPago: { tipo: sql.BigInt, valor: idIntentoPago },
      Resolucion: { tipo: sql.VarChar(16), valor: resolucion },
      Motivo: { tipo: sql.NVarChar(250), valor: motivo },
      IDTransaccion: { tipo: sql.VarChar(64), valor: idTransaccion },
    });
    if (fila === undefined)
      throw new Error('SP_Pedidos_ResolverPagoEnRevision no devolvió el intento');
    return {
      idIntentoPago: Number(fila.IDIntentoPago),
      estado: fila.Estado,
      resolucion: fila.ResolucionManual,
      motivo: fila.MotivoResolucion,
      fechaResolucion: fila.FechaResolucion,
      idPedido: fila.IDPedido,
      idReembolso: fila.IDReembolso,
    };
  },

  /** E9-H04: un reembolso Fallido pasa a ResueltoManual. */
  async resolverReembolso(idReembolso: number, datos: ResolverReembolso): Promise<Reembolso> {
    const [fila] = await ejecutarSP<FilaReembolso>('SP_Pedidos_ResolverReembolso', {
      IDReembolso: { tipo: sql.Int, valor: idReembolso },
      Motivo: { tipo: sql.NVarChar(250), valor: datos.motivo },
      Referencia: { tipo: sql.NVarChar(100), valor: datos.referencia },
    });
    if (fila === undefined)
      throw new Error('SP_Pedidos_ResolverReembolso no devolvió el reembolso');
    return aReembolso(fila);
  },

  /** null si el reembolso no existe. */
  async reintentarReembolso(idReembolso: number): Promise<EstadoReembolso | null> {
    const [fila] = await ejecutarSP<{ Estado: EstadoReembolso }>('SP_Pedidos_ReintentarReembolso', {
      IDReembolso: { tipo: sql.Int, valor: idReembolso },
    });
    return fila?.Estado ?? null;
  },

  /** RF-01: null si no existe o si es de otro cliente. */
  obtener(idPedido: number): Promise<Pedido | null> {
    return pedidoDe('SP_Pedidos_ObtenerDetalle', { IDPedido: { tipo: sql.Int, valor: idPedido } });
  },
};

export type PedidosRepository = typeof pedidosRepository;
