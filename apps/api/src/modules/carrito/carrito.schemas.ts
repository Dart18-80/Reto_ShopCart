import { montoSchema } from '@shopcart/shared';
import { idEnRutaSchema, idSchema } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';
import { ESTADOS_EXISTENCIA } from '../catalogo/index.js';
import { ESTADOS_LINEA, TIPOS_AJUSTE_FUSION, TIPOS_AVISO } from './carrito.types.js';

// Tope técnico de una línea, lejos del desborde de INT; el límite real es el disponible (N-06).
const CANTIDAD_MAXIMA = 1_000_000;
const cantidadSchema = z.number().int().min(1).max(CANTIDAD_MAXIMA);

export const COOKIE_CARRITO = 'carrito_invitado';
// N-05: 256 bits en base64url. Un valor que no puede ser un token cuenta como cookie ausente.
const TOKEN_INVITADO = /^[A-Za-z0-9_-]{43}$/;

export const cookiesCarritoSchema = z.object({
  [COOKIE_CARRITO]: z
    .string()
    .optional()
    .transform((valor) => (valor !== undefined && TOKEN_INVITADO.test(valor) ? valor : undefined)),
});

// RF-01: .strict() rechaza un idCarrito colado en el cuerpo; el carrito sale de la sesión o la cookie.
export const agregarLineaSchema = z
  .object({ idVariante: idSchema, cantidad: cantidadSchema })
  .strict()
  .openapi('AgregarLineaCarrito');

// Para quitar una línea se usa DELETE: cantidad 0 se rechaza.
export const actualizarCantidadSchema = z
  .object({ cantidad: cantidadSchema })
  .strict()
  .openapi('ActualizarCantidadCarrito');

export const aplicarCuponSchema = z
  .object({ codigo: z.string().trim().min(1).max(30) })
  .strict()
  .openapi('AplicarCupon');

export const paramsIdLineaSchema = z.object({ idLinea: idEnRutaSchema });

const lineaCarritoSchema = z
  .object({
    idLinea: z.number().int(),
    idVariante: z.number().int(),
    idProducto: z.number().int(),
    producto: z.string(),
    sku: z.string(),
    descripcionAtributos: z.string(),
    imagen: z.string().nullable(),
    cantidad: z.number().int(),
    precioUnitario: montoSchema,
    totalLinea: montoSchema,
    totalComprable: montoSchema.openapi({
      description:
        'N-12: lo que la línea puede comprar ahora; es lo que suman el subtotal y el descuento',
    }),
    descuentoLinea: montoSchema,
    estado: z.enum(ESTADOS_LINEA),
    ajustarA: z.number().int().nullable(),
    existencia: z.object({
      estado: z.enum(ESTADOS_EXISTENCIA),
      unidadesRestantes: z.number().int().nullable(),
    }),
    garantiaHasta: z.iso.datetime(),
    aviso: z
      .object({ tipo: z.enum(TIPOS_AVISO), precioAnterior: montoSchema.nullable() })
      .nullable(),
  })
  .openapi('LineaCarrito');

export const carritoSchema = z
  .object({
    lineas: z.array(lineaCarritoSchema),
    resumen: z.object({
      lineas: z.number().int(),
      unidades: z.number().int(),
      subtotal: montoSchema,
      descuento: montoSchema,
      total: montoSchema,
      puedePagar: z.boolean(),
      cupon: z.object({ codigo: z.string(), descripcion: z.string() }).nullable(),
      cuponRetirado: z
        .object({ codigo: z.string(), motivo: z.string(), mensaje: z.string() })
        .nullable()
        .openapi({ description: 'N-12: el cupón dejó de ser válido y se quitó en esta consulta' }),
      envioGratis: z
        .object({ montoMinimo: montoSchema, faltante: montoSchema, alcanzado: z.boolean() })
        .nullable()
        .openapi({
          description:
            'N-04: cuánto falta para el envío gratis, sobre el total después del cupón; null sin carrito o sin envío gratis',
        }),
    }),
  })
  .openapi('Carrito');

export type AgregarLinea = z.infer<typeof agregarLineaSchema>;

/** N-05: los avisos del carrito de invitado en la respuesta del inicio de sesión y del registro. */
export const avisoFusionSchema = z
  .discriminatedUnion('tipo', [
    z.object({
      tipo: z.enum(TIPOS_AJUSTE_FUSION),
      idVariante: z.number().int(),
      producto: z.string(),
      cantidadSolicitada: z.number().int(),
      cantidadFinal: z.number().int(),
    }),
    z.object({ tipo: z.literal('FusionPendiente'), mensaje: z.string() }),
  ])
  .openapi('AvisoFusionCarrito');
