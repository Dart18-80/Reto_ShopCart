import { consultaPaginacionSchema, idEnRutaSchema, idSchema } from '../../shared/http/index.js';
import { textoNvarchar } from '@shopcart/shared';
import { z } from '../../shared/openapi/zod.js';
import { ESTADOS_PEDIDO, ESTADOS_REEMBOLSO } from './pedidos.types.js';

export const paramsIdPedidoSchema = z.object({ id: idEnRutaSchema });

export const listarPedidosPropiosSchema = consultaPaginacionSchema;

// A-12: las fechas de la gestión son días de Guatemala sobre FechaPagoLocal, igual que los reportes (N-11).
export const listarPedidosGestionSchema = consultaPaginacionSchema
  .extend({
    estado: z.enum(ESTADOS_PEDIDO).optional(),
    idCliente: z.coerce.number().pipe(idSchema).optional(),
    desde: z.iso.date().optional(),
    hasta: z.iso.date().optional(),
  })
  .refine(({ desde, hasta }) => desde === undefined || hasta === undefined || desde <= hasta, {
    message: 'La fecha inicial no puede ser posterior a la final.',
    path: ['desde'],
  });

export type ListarPedidosPropios = z.infer<typeof listarPedidosPropiosSchema>;
export type ListarPedidosGestion = z.infer<typeof listarPedidosGestionSchema>;

// RF-07: el motivo es opcional en los cambios de gestión (NVARCHAR(250)).
export const cambiarEstadoSchema = z
  .object({
    estadoEsperado: z.enum(ESTADOS_PEDIDO),
    estadoNuevo: z.enum(ESTADOS_PEDIDO),
    motivo: textoNvarchar(250).optional(),
  })
  .strict()
  .openapi('CambiarEstadoPedido');

export type CambiarEstado = z.infer<typeof cambiarEstadoSchema>;

// N-09: el motivo de una cancelación es obligatorio (textoNvarchar no admite solo espacios).
export const cancelarPedidoSchema = z
  .object({ motivo: textoNvarchar(250) })
  .strict()
  .openapi('CancelarPedido');

export const paramsIdReembolsoSchema = z.object({ id: idEnRutaSchema });

export const listarReembolsosSchema = consultaPaginacionSchema.extend({
  estado: z.enum(ESTADOS_REEMBOLSO).optional(),
});

export type CancelarPedido = z.infer<typeof cancelarPedidoSchema>;
export type ListarReembolsos = z.infer<typeof listarReembolsosSchema>;

// N-10: el SP valida contra lo vendido bajo bloqueo; aquí solo la forma (líneas únicas, cantidades > 0).
const MAX_LINEAS_DEVOLUCION = 50;
const CANTIDAD_MAXIMA = 1_000_000;
export const registrarDevolucionSchema = z
  .object({
    motivo: textoNvarchar(250),
    lineas: z
      .array(
        z
          .object({
            idDetallePedido: idSchema,
            cantidad: z.number().int().min(1).max(CANTIDAD_MAXIMA),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_LINEAS_DEVOLUCION)
      .refine(
        (lineas) => new Set(lineas.map((l) => l.idDetallePedido)).size === lineas.length,
        'Una línea aparece más de una vez en la devolución.',
      ),
  })
  .strict()
  .openapi('RegistrarDevolucion');

export type RegistrarDevolucion = z.infer<typeof registrarDevolucionSchema>;
