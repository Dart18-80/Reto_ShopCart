import { consultaPaginacionSchema, idEnRutaSchema, idSchema } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';
import { ESTADOS_PEDIDO } from './pedidos.types.js';

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
