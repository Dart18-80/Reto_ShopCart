import { montoSchema } from '@shopcart/shared';
import { idEnRutaSchema, idSchema } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';
import { ESTADOS_EXISTENCIA } from '../catalogo/index.js';
import { ESTADOS_LINEA } from './carrito.types.js';

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
    estado: z.enum(ESTADOS_LINEA),
    ajustarA: z.number().int().nullable(),
    existencia: z.object({
      estado: z.enum(ESTADOS_EXISTENCIA),
      unidadesRestantes: z.number().int().nullable(),
    }),
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
    }),
  })
  .openapi('Carrito');

export type AgregarLinea = z.infer<typeof agregarLineaSchema>;
