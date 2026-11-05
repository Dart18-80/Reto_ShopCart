import { z } from 'zod';
import { idSchema } from './consultas.js';

// Tope técnico de una línea, lejos del desborde de INT; el límite real es el disponible (N-06), que decide el SP.
const CANTIDAD_MAXIMA = 1_000_000;
const cantidadSchema = z.number().int().min(1).max(CANTIDAD_MAXIMA);

// RF-01: .strict() rechaza un idCarrito colado en el cuerpo; el carrito sale de la sesión o la cookie.
export const agregarLineaSchema = z
  .object({ idVariante: idSchema, cantidad: cantidadSchema })
  .strict();

// Para quitar una línea se usa DELETE: cantidad 0 se rechaza.
export const actualizarCantidadSchema = z.object({ cantidad: cantidadSchema }).strict();

export type AgregarLinea = z.infer<typeof agregarLineaSchema>;
export type ActualizarCantidad = z.infer<typeof actualizarCantidadSchema>;
