import { montoSchema } from '@shopcart/shared';
import { montoATexto } from '../../shared/dinero/index.js';
import { z } from '../../shared/openapi/zod.js';
import {
  CAUSAS_REVISION,
  ESTADOS_PAGO,
  ESTADOS_REEMBOLSO,
  ORIGENES_REEMBOLSO,
  ESTADOS_PAGO_RESUELTO,
  RESOLUCIONES_PAGO,
  type PagoEnRevision,
  type ResolucionDePago,
  type Cancelacion,
  type DevolucionRegistrada,
  type Pedido,
  type Reembolso,
  type ResumenPedido,
  type ResumenPedidoGestion,
} from './pedidos.types.js';

/** El pedido en JSON (montos como texto, A-21). Lo usan el checkout y las rutas de pedidos. */
export const pedidoARespuesta = (pedido: Pedido) => ({
  ...pedido,
  subtotal: montoATexto(pedido.subtotal),
  descuento: montoATexto(pedido.descuento),
  costoEnvio: montoATexto(pedido.costoEnvio),
  total: montoATexto(pedido.total),
  baseImponible: montoATexto(pedido.baseImponible),
  iva: montoATexto(pedido.iva),
  montoReembolsado: montoATexto(pedido.montoReembolsado),
  fechaPago: pedido.fechaPago.toISOString(),
  lineas: pedido.lineas.map((linea) => ({
    ...linea,
    precioUnitario: montoATexto(linea.precioUnitario),
    descuentoLinea: montoATexto(linea.descuentoLinea),
    totalLinea: montoATexto(linea.totalLinea),
  })),
  historial: pedido.historial.map((cambio) => ({ ...cambio, fecha: cambio.fecha.toISOString() })),
});

export const resumenARespuesta = (resumen: ResumenPedido) => ({
  ...resumen,
  total: montoATexto(resumen.total),
  fechaPago: resumen.fechaPago.toISOString(),
});

export const resumenGestionARespuesta = (resumen: ResumenPedidoGestion) => ({
  ...resumenARespuesta(resumen),
  cliente: resumen.cliente,
});

export const pedidoSchema = z
  .object({
    idPedido: z.number().int(),
    numeroPedido: z.string(),
    estado: z.string(),
    estadoPago: z.enum(ESTADOS_PAGO),
    puedeCancelar: z.boolean().openapi({
      description:
        'M5-H01: si quien pide puede cancelarlo ahora (TransicionEstadoPedido para su rol y el pago no está en verificación)',
    }),
    subtotal: montoSchema,
    descuento: montoSchema,
    costoEnvio: montoSchema,
    total: montoSchema,
    baseImponible: montoSchema,
    iva: montoSchema,
    montoReembolsado: montoSchema,
    codigoCupon: z.string().nullable(),
    envio: z.object({ nombre: z.string(), fechaEstimadaEntrega: z.iso.date() }),
    fechaPago: z.iso.datetime(),
    fechaPagoLocal: z.iso.date(),
    tarjeta: z.object({ marca: z.string(), ultimosDigitos: z.string() }),
    direccion: z.object({
      nombreRecibe: z.string(),
      telefonoRecibe: z.string(),
      departamento: z.string(),
      municipio: z.string(),
      direccionLinea: z.string(),
      referencia: z.string().nullable(),
    }),
    lineas: z.array(
      z.object({
        idDetallePedido: z.number().int(),
        idVariante: z.number().int(),
        sku: z.string(),
        producto: z.string(),
        descripcionVariante: z.string(),
        categoria: z.string(),
        cantidad: z.number().int(),
        cantidadDevuelta: z.number().int(),
        precioUnitario: montoSchema,
        descuentoLinea: montoSchema,
        totalLinea: montoSchema,
      }),
    ),
    historial: z.array(
      z.object({
        estadoAnterior: z.string().nullable(),
        estadoNuevo: z.string(),
        rol: z.string(),
        motivo: z.string().nullable(),
        fecha: z.iso.datetime(),
      }),
    ),
  })
  .openapi('Pedido');

export const resumenPedidoSchema = z
  .object({
    idPedido: z.number().int(),
    numeroPedido: z.string(),
    estado: z.string(),
    estadoPago: z.enum(ESTADOS_PAGO),
    total: montoSchema,
    articulos: z.number().int(),
    fechaPago: z.iso.datetime(),
    fechaPagoLocal: z.iso.date(),
  })
  .openapi('ResumenPedido');

export const resumenPedidoGestionSchema = resumenPedidoSchema
  .extend({
    cliente: z.object({ idUsuario: z.number().int(), nombre: z.string(), correo: z.string() }),
  })
  .openapi('ResumenPedidoGestion');

export const cancelacionARespuesta = ({ pedido, reembolso }: Cancelacion) => ({
  pedido: pedidoARespuesta(pedido),
  reembolso,
});

export const reembolsoARespuesta = (reembolso: Reembolso) => ({
  ...reembolso,
  monto: montoATexto(reembolso.monto),
  fechaProximoIntento: reembolso.fechaProximoIntento?.toISOString() ?? null,
  fechaCompletado: reembolso.fechaCompletado?.toISOString() ?? null,
  fechaCreacion: reembolso.fechaCreacion.toISOString(),
  fechaResolucion: reembolso.fechaResolucion?.toISOString() ?? null,
});

export const cancelacionSchema = z
  .object({
    pedido: pedidoSchema,
    reembolso: z.object({ idReembolso: z.number().int(), estado: z.enum(ESTADOS_REEMBOLSO) }),
  })
  .openapi('Cancelacion');

/**
 * E9-H04 (decisión del PO): REEMBOLSO_YA_PROCESADO y REEMBOLSO_SIN_COBRO responden 409 aunque el reembolso sí cambió;
 * `detalles.estado` dice en qué estado quedó (Completado o NoAplica), sin tener que releerlo.
 */
export const errorResolucionReembolsoSchema = z
  .object({
    error: z.object({
      codigo: z.string(),
      mensaje: z.string(),
      detalles: z.object({ estado: z.enum(ESTADOS_REEMBOLSO) }).optional(),
      requestId: z.uuid(),
    }),
  })
  .openapi('ErrorResolucionReembolso');

export const reembolsoSchema = z
  .object({
    idReembolso: z.number().int(),
    idPedido: z.number().int().nullable(),
    numeroPedido: z.string().nullable(),
    idIntentoPago: z.number().int().nullable(),
    idDevolucion: z.number().int().nullable(),
    origen: z.enum(ORIGENES_REEMBOLSO),
    monto: montoSchema,
    estado: z.enum(ESTADOS_REEMBOLSO),
    intentos: z.number().int(),
    ultimoError: z.string().nullable(),
    idTransaccionReembolso: z.string().nullable(),
    fechaProximoIntento: z.iso.datetime().nullable(),
    fechaCompletado: z.iso.datetime().nullable(),
    fechaCreacion: z.iso.datetime(),
    motivoResolucion: z.string().nullable(),
    referenciaResolucion: z.string().nullable(),
    fechaResolucion: z.iso.datetime().nullable(),
  })
  .openapi('Reembolso');

export const pagoEnRevisionARespuesta = (pago: PagoEnRevision) => ({
  ...pago,
  monto: montoATexto(pago.monto),
  fecha: pago.fecha.toISOString(),
});

export const pagoEnRevisionSchema = z
  .object({
    idIntentoPago: z.number().int(),
    idPedido: z.number().int().nullable(),
    numeroPedido: z.string().nullable(),
    cliente: z.object({ idUsuario: z.number().int(), nombre: z.string(), correo: z.string() }),
    monto: montoSchema,
    idTransaccion: z.string().nullable(),
    tarjeta: z.object({ marca: z.string().nullable(), ultimosDigitos: z.string().nullable() }),
    causa: z.enum(CAUSAS_REVISION),
    fecha: z.iso.datetime(),
  })
  .openapi('PagoEnRevision');

export const resolucionPagoARespuesta = ({
  pedido,
  fechaResolucion,
  ...resto
}: ResolucionDePago) => ({
  ...resto,
  fechaResolucion: fechaResolucion.toISOString(),
  pedido: pedido === null ? null : pedidoARespuesta(pedido),
});

export const resolucionPagoSchema = z
  .object({
    idIntentoPago: z.number().int(),
    estado: z.enum(ESTADOS_PAGO_RESUELTO),
    resolucion: z.enum(RESOLUCIONES_PAGO),
    motivo: z.string(),
    fechaResolucion: z.iso.datetime(),
    pedido: pedidoSchema.nullable(),
    reembolso: z
      .object({ idReembolso: z.number().int(), estado: z.enum(ESTADOS_REEMBOLSO) })
      .nullable(),
  })
  .openapi('ResolucionPago');

export const devolucionARespuesta = ({ pedido, devolucion, reembolso }: DevolucionRegistrada) => ({
  pedido: pedidoARespuesta(pedido),
  devolucion: { ...devolucion, montoReembolso: montoATexto(devolucion.montoReembolso) },
  reembolso,
});

export const devolucionRegistradaSchema = z
  .object({
    pedido: pedidoSchema,
    devolucion: z.object({ idDevolucion: z.number().int(), montoReembolso: montoSchema }),
    reembolso: z.object({ idReembolso: z.number().int(), estado: z.enum(ESTADOS_REEMBOLSO) }),
  })
  .openapi('DevolucionRegistrada');
