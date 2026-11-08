import {
  consultaPaginacionSchema,
  idBigintEnRutaSchema,
  idEnRutaSchema,
  idSchema,
} from '../../shared/http/index.js';
import {
  cancelarPedidoSchema as cancelarCompartido,
  consultaPedidosGestionSchema,
  ESTADOS_PEDIDO,
  textoNvarchar,
} from '@shopcart/shared';
import { registroOpenApi } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import { ESTADOS_REEMBOLSO, RESOLUCIONES_PAGO } from './pedidos.types.js';

export const paramsIdPedidoSchema = z.object({ id: idEnRutaSchema });

export const listarPedidosPropiosSchema = consultaPaginacionSchema;

// FE-03: la consulta de la gestión vive en @shopcart/shared; la web la valida igual en la URL.
export const listarPedidosGestionSchema = consultaPedidosGestionSchema;

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

// FE-03: el cuerpo de la cancelación vive en @shopcart/shared, el mismo que valida el diálogo de la web.
export const cancelarPedidoSchema = registroOpenApi.register('CancelarPedido', cancelarCompartido);

export const paramsIdReembolsoSchema = z.object({ id: idEnRutaSchema });

export const listarReembolsosSchema = consultaPaginacionSchema.extend({
  estado: z.enum(ESTADOS_REEMBOLSO).optional(),
});

export type ListarReembolsos = z.infer<typeof listarReembolsosSchema>;

// E9-H04: la revisión manual de pagos y reembolsos (solo Admin).
export const paramsIdIntentoSchema = z.object({ id: idBigintEnRutaSchema });

export const listarPagosEnRevisionSchema = consultaPaginacionSchema;

export type ListarPagosEnRevision = z.infer<typeof listarPagosEnRevisionSchema>;

export const resolverPagoSchema = z
  .object({ resolucion: z.enum(RESOLUCIONES_PAGO), motivo: textoNvarchar(250) })
  .strict()
  .openapi('ResolverPago');

export type ResolverPago = z.infer<typeof resolverPagoSchema>;

export const resolverReembolsoSchema = z
  .object({ motivo: textoNvarchar(250), referencia: textoNvarchar(100) })
  .strict()
  .openapi('ResolverReembolso');

export type ResolverReembolso = z.infer<typeof resolverReembolsoSchema>;

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
