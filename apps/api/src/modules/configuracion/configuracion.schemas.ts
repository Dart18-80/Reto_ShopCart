import { montoSchema } from '@shopcart/shared';
import { Decimal } from 'decimal.js';
import { z } from '../../shared/openapi/zod.js';

// A-14: los mismos rangos que los CHECK de ParametroSistema (V006); la base es la última defensa.
const entre = (minimo: number, maximo: number) => z.number().int().min(minimo).max(maximo);

// PATCH: lo que no llega se conserva; montoEnvioGratis en null deja la tienda sin envío gratis.
export const actualizarConfiguracionSchema = z
  .object({
    diasGarantiaPrecio: entre(1, 30).optional(),
    minutosReserva: entre(5, 60).optional(),
    horasCarritoAbandonado: entre(1, 720).optional(),
    diasExpiracionCarritoInvitado: entre(1, 365).optional(),
    umbralUltimasUnidades: entre(1, 100).optional(),
    montoEnvioGratis: montoSchema
      .transform((valor) => new Decimal(valor))
      .refine((valor) => valor.greaterThan(0), 'Debe ser mayor que cero.')
      .nullable()
      .optional(),
    maxIntentosPagoRechazados: entre(1, 10).optional(),
    diasPlazoDevolucion: entre(1, 365).optional(),
    maxLineasCarrito: entre(1, 200).optional(),
  })
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un parámetro.')
  .openapi('ActualizarConfiguracion');

export const configuracionSchema = z
  .object({
    diasGarantiaPrecio: z.number().int(),
    minutosReserva: z.number().int(),
    horasCarritoAbandonado: z.number().int(),
    diasExpiracionCarritoInvitado: z.number().int(),
    umbralUltimasUnidades: z.number().int(),
    montoEnvioGratis: montoSchema.nullable(),
    maxIntentosPagoRechazados: z.number().int(),
    diasPlazoDevolucion: z.number().int(),
    maxLineasCarrito: z.number().int(),
    fechaActualizacion: z.iso.datetime(),
  })
  .openapi('Configuracion');

export type ActualizarConfiguracion = z.infer<typeof actualizarConfiguracionSchema>;
