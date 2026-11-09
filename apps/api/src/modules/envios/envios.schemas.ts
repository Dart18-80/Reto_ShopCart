import { actualizarMetodoEnvioSchema, montoSchema } from '@shopcart/shared';
import { Decimal } from 'decimal.js';
import { idEnRutaSchema } from '../../shared/http/index.js';
import { registroOpenApi } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';

// M9-H02 (FE-03): el PUT vive en @shopcart/shared. La ruta documenta el esquema compartido; el controlador valida
// con la versión de entrada, que además pasa el costo a Decimal (A-21).
export const actualizarMetodoSchema = registroOpenApi.register(
  'ActualizarMetodoEnvio',
  actualizarMetodoEnvioSchema,
);
export const actualizarMetodoEntradaSchema = actualizarMetodoSchema.transform((metodo) => ({
  ...metodo,
  costo: new Decimal(metodo.costo),
}));

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
        totalConEnvio: montoSchema.openapi({
          description: 'El total del carrito después del cupón más el costo de este método',
        }),
      }),
    ),
    minutosReserva: z.number().int().openapi({
      description: 'Lo que dura la reserva de los productos al iniciar el pago (MinutosReserva)',
    }),
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

export type ActualizarMetodo = z.output<typeof actualizarMetodoEntradaSchema>;
