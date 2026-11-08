import {
  consultaPaginacionSchema,
  idBigintEnRutaSchema,
  idEnRutaSchema,
} from '../../shared/http/index.js';
import {
  cambiarEstadoPedidoSchema as cambiarEstadoCompartido,
  cancelarPedidoSchema as cancelarCompartido,
  consultaPedidosGestionSchema,
  registrarDevolucionSchema as registrarDevolucionCompartido,
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

// FE-03: el cambio de estado vive en @shopcart/shared, el mismo que valida el diálogo de la gestión.
export const cambiarEstadoSchema = registroOpenApi.register(
  'CambiarEstadoPedido',
  cambiarEstadoCompartido,
);

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

// FE-03: la devolución vive en @shopcart/shared, la misma que valida el diálogo de la gestión (N-10).
export const registrarDevolucionSchema = registroOpenApi.register(
  'RegistrarDevolucion',
  registrarDevolucionCompartido,
);

export type RegistrarDevolucion = z.infer<typeof registrarDevolucionSchema>;
