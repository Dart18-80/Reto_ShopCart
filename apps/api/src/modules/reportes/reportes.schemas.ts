import { montoSchema, ordenConsultaSchema } from '@shopcart/shared';
import { rangoDeFechasSchema, consultaPaginacionSchema } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';
import { AGRUPACIONES } from './reportes.types.js';

// A-12: días de Guatemala (FechaPagoLocal / FechaLocal); sin rango, los últimos 30 días.
export const consultaRangoSchema = rangoDeFechasSchema;

export const consultaVentasSchema = rangoDeFechasSchema.safeExtend({
  agrupacion: z.enum(AGRUPACIONES).default('dia'),
});

// M6-H01: por defecto, del mayor monto potencial al menor (lo supone la exportación); inactividad desc es la
// última actividad más antigua primero.
export const ordenCarritosSchema = ordenConsultaSchema(['inactividad', 'total'], 'total', 'desc');

export const consultaCarritosSchema = rangoDeFechasSchema.safeExtend({
  ...consultaPaginacionSchema.shape,
  ...ordenCarritosSchema.shape,
});

export type ConsultaRango = z.infer<typeof consultaRangoSchema>;
export type ConsultaVentas = z.infer<typeof consultaVentasSchema>;
export type ConsultaCarritos = z.infer<typeof consultaCarritosSchema>;

// Las ventas netas de un periodo pueden ser negativas si solo hubo devoluciones (N-11).
const montoConSigno = z.string().regex(/^-?\d+\.\d{2}$/);

export const resumenSchema = z
  .object({
    desde: z.iso.date(),
    hasta: z.iso.date(),
    ventas: montoConSigno,
    pedidos: z.number().int(),
    ticketPromedio: montoConSigno,
    unidades: z.number().int(),
    devoluciones: montoSchema,
    envio: montoSchema,
    carritosAbandonados: z.number().int(),
    montoPotencialPerdido: montoSchema,
  })
  .openapi('ResumenDashboard');

export const ventasDelPeriodoSchema = z
  .object({ periodo: z.iso.date(), ventas: montoConSigno, pedidos: z.number().int() })
  .openapi('VentasDelPeriodo');

export const ventasDeCategoriaSchema = z
  .object({
    idCategoria: z.number().int(),
    categoria: z.string(),
    unidades: z.number().int(),
    ventas: montoConSigno,
  })
  .openapi('VentasDeCategoria');

export const productoVendidoSchema = z
  .object({
    idProducto: z.number().int(),
    producto: z.string(),
    unidades: z.number().int(),
    ventas: montoConSigno,
  })
  .openapi('ProductoVendido');

export const carritoAbandonadoSchema = z
  .object({
    idCarrito: z.number().int(),
    cliente: z.object({ idUsuario: z.number().int(), nombre: z.string() }).nullable(),
    fechaUltimaActividad: z.iso.datetime(),
    lineas: z.number().int(),
    unidades: z.number().int(),
    montoPotencial: montoSchema,
  })
  .openapi('CarritoAbandonado');

/** E9-H02: el stream del dashboard. El token llega en Authorization (A-25), nunca en la URL. */
export const encabezadosEventosSchema = z.object({
  authorization: z.string().optional(),
  // El id del último evento que recibió el cliente al reconectar: `ventas3.carritos7`.
  'last-event-id': z.string().max(100).optional(),
});
