import { montoSchema } from '@shopcart/shared';
import { montoATexto } from '../../shared/dinero/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { Pedido } from './pedidos.types.js';

/** El pedido en JSON (montos como texto, A-21). Lo usan el checkout y, en E6, las rutas de pedidos. */
export const pedidoARespuesta = (pedido: Pedido) => ({
  ...pedido,
  subtotal: montoATexto(pedido.subtotal),
  descuento: montoATexto(pedido.descuento),
  costoEnvio: montoATexto(pedido.costoEnvio),
  total: montoATexto(pedido.total),
  baseImponible: montoATexto(pedido.baseImponible),
  iva: montoATexto(pedido.iva),
  fechaPago: pedido.fechaPago.toISOString(),
  lineas: pedido.lineas.map((linea) => ({
    ...linea,
    precioUnitario: montoATexto(linea.precioUnitario),
    descuentoLinea: montoATexto(linea.descuentoLinea),
    totalLinea: montoATexto(linea.totalLinea),
  })),
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
        idVariante: z.number().int(),
        sku: z.string(),
        producto: z.string(),
        descripcionVariante: z.string(),
        categoria: z.string(),
        cantidad: z.number().int(),
        precioUnitario: montoSchema,
        descuentoLinea: montoSchema,
        totalLinea: montoSchema,
      }),
    ),
  })
  .openapi('Pedido');
