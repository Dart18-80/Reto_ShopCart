import { montoSchema } from '@shopcart/shared';
import { montoATexto } from '../../shared/dinero/index.js';
import { z } from '../../shared/openapi/zod.js';
import {
  ESTADOS_REEMBOLSO,
  type Cancelacion,
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
});

export const cancelacionSchema = z
  .object({
    pedido: pedidoSchema,
    reembolso: z.object({ idReembolso: z.number().int(), estado: z.enum(ESTADOS_REEMBOLSO) }),
  })
  .openapi('Cancelacion');

export const reembolsoSchema = z
  .object({
    idReembolso: z.number().int(),
    idPedido: z.number().int(),
    numeroPedido: z.string(),
    idDevolucion: z.number().int().nullable(),
    origen: z.enum(['Cancelacion', 'Devolucion']),
    monto: montoSchema,
    estado: z.enum(ESTADOS_REEMBOLSO),
    intentos: z.number().int(),
    ultimoError: z.string().nullable(),
    idTransaccionReembolso: z.string().nullable(),
    fechaProximoIntento: z.iso.datetime().nullable(),
    fechaCompletado: z.iso.datetime().nullable(),
    fechaCreacion: z.iso.datetime(),
  })
  .openapi('Reembolso');
