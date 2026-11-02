import { montoSchema } from '@shopcart/shared';
import { consultaPaginacionSchema } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';
import { AGRUPACIONES } from './reportes.types.js';

// A-12: días de Guatemala (FechaPagoLocal / FechaLocal); sin rango, los últimos 30 días.
const rangoBase = z.object({ desde: z.iso.date().optional(), hasta: z.iso.date().optional() });
const rangoValido = ({ desde, hasta }: { desde?: string; hasta?: string }) =>
  desde === undefined || hasta === undefined || desde <= hasta;
const MENSAJE_RANGO = {
  message: 'La fecha inicial no puede ser posterior a la final.',
  path: ['desde'],
};

export const consultaRangoSchema = rangoBase.refine(rangoValido, MENSAJE_RANGO);

export const consultaVentasSchema = rangoBase
  .extend({ agrupacion: z.enum(AGRUPACIONES).default('dia') })
  .refine(rangoValido, MENSAJE_RANGO);

export const consultaCarritosSchema = rangoBase
  .extend(consultaPaginacionSchema.shape)
  .refine(rangoValido, MENSAJE_RANGO);

export type ConsultaRango = z.infer<typeof consultaRangoSchema>;
export type ConsultaVentas = z.infer<typeof consultaVentasSchema>;
export type ConsultaCarritos = z.infer<typeof consultaCarritosSchema>;

export const resumenSchema = z
  .object({
    desde: z.iso.date(),
    hasta: z.iso.date(),
    ventas: montoSchema,
    pedidos: z.number().int(),
    ticketPromedio: montoSchema,
    unidades: z.number().int(),
    devoluciones: montoSchema,
    envio: montoSchema,
    carritosAbandonados: z.number().int(),
    montoPotencialPerdido: montoSchema,
  })
  .openapi('ResumenDashboard');

// Las ventas netas de un periodo pueden ser negativas si solo hubo devoluciones (N-11).
const montoConSigno = z.string().regex(/^-?\d+\.\d{2}$/);

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
