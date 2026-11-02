import { montoSchema, textoNvarchar } from '@shopcart/shared';
import { Decimal } from 'decimal.js';
import { idEnRutaSchema } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';

// MetodoEnvio.DiasMin y DiasMax son TINYINT.
const DIAS_MAXIMOS = 255;
const diasSchema = z.number().int().min(0).max(DIAS_MAXIMOS);

// PUT: la representación completa de lo que el Admin puede cambiar; el código no cambia.
export const actualizarMetodoSchema = z
  .object({
    nombre: textoNvarchar(50),
    costo: montoSchema.transform((valor) => new Decimal(valor)),
    diasMin: diasSchema,
    diasMax: diasSchema,
    activo: z.boolean(),
  })
  .strict()
  .refine((metodo) => metodo.diasMax >= metodo.diasMin, {
    message: 'Los días máximos no pueden ser menos que los mínimos.',
    path: ['diasMax'],
  })
  .openapi('ActualizarMetodoEnvio');

export const paramsIdMetodoSchema = z.object({ id: idEnRutaSchema });

const envioGratisSchema = z
  .object({ montoMinimo: montoSchema, faltante: montoSchema, alcanzado: z.boolean() })
  .nullable()
  .openapi('EnvioGratis', {
    description:
      'N-04: sobre el subtotal de productos después del cupón; null si no hay envío gratis',
  });

export const metodosParaCarritoSchema = z
  .object({
    metodos: z.array(
      z.object({
        idMetodoEnvio: z.number().int(),
        codigo: z.string(),
        nombre: z.string(),
        diasMin: z.number().int(),
        diasMax: z.number().int(),
        tarifa: montoSchema,
        costo: montoSchema,
        envioGratis: z.boolean(),
      }),
    ),
    envioGratis: envioGratisSchema,
  })
  .openapi('MetodosEnvioParaCarrito');

export const metodoEnvioSchema = z
  .object({
    idMetodoEnvio: z.number().int(),
    codigo: z.string(),
    nombre: z.string(),
    costo: montoSchema,
    diasMin: z.number().int(),
    diasMax: z.number().int(),
    activo: z.boolean(),
  })
  .openapi('MetodoEnvio');

export type ActualizarMetodo = z.infer<typeof actualizarMetodoSchema>;
