import {
  consultaPaginacionSchema,
  idBigintEnRutaSchema,
  idEnRutaSchema,
} from '../../shared/http/index.js';
import {
  cambiarEstadoPedidoSchema as cambiarEstadoCompartido,
  cancelarPedidoSchema as cancelarCompartido,
  consultaPedidosGestionSchema,
  consultaReembolsosSchema,
  registrarDevolucionSchema as registrarDevolucionCompartido,
  resolverPagoSchema as resolverPagoCompartido,
  resolverReembolsoSchema as resolverReembolsoCompartido,
} from '@shopcart/shared';
import { registroOpenApi } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';

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

// FE-03: la consulta y los cuerpos de la revisión manual viven en @shopcart/shared (M8-H05).
export const listarReembolsosSchema = consultaReembolsosSchema;

export type ListarReembolsos = z.infer<typeof listarReembolsosSchema>;

// E9-H04: la revisión manual de pagos y reembolsos (solo Admin).
export const paramsIdIntentoSchema = z.object({ id: idBigintEnRutaSchema });

export const listarPagosEnRevisionSchema = consultaPaginacionSchema;

export type ListarPagosEnRevision = z.infer<typeof listarPagosEnRevisionSchema>;

export const resolverPagoSchema = registroOpenApi.register('ResolverPago', resolverPagoCompartido);

export type ResolverPago = z.infer<typeof resolverPagoSchema>;

export const resolverReembolsoSchema = registroOpenApi.register(
  'ResolverReembolso',
  resolverReembolsoCompartido,
);

export type ResolverReembolso = z.infer<typeof resolverReembolsoSchema>;

// FE-03: la devolución vive en @shopcart/shared, la misma que valida el diálogo de la gestión (N-10).
export const registrarDevolucionSchema = registroOpenApi.register(
  'RegistrarDevolucion',
  registrarDevolucionCompartido,
);

export type RegistrarDevolucion = z.infer<typeof registrarDevolucionSchema>;
