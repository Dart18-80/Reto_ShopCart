import { z } from 'zod';
import { enteroEntre } from './numeros.js';
import { montoMenorOIgual, montoSchema } from './monto.js';

// A-14: los mismos rangos que los CHECK de ParametroSistema (V006); la base es la última defensa.
/** A-14: el rango de cada parámetro, para el formulario del backoffice (M9-H02) y para la API. */
export const RANGOS_CONFIGURACION = {
  diasGarantiaPrecio: [1, 30],
  minutosReserva: [5, 60],
  horasCarritoAbandonado: [1, 720],
  diasExpiracionCarritoInvitado: [1, 365],
  umbralUltimasUnidades: [1, 100],
  maxIntentosPagoRechazados: [1, 10],
  diasPlazoDevolucion: [1, 365],
  maxLineasCarrito: [1, 200],
} as const;

const enRango = (campo: keyof typeof RANGOS_CONFIGURACION) => {
  const [minimo, maximo] = RANGOS_CONFIGURACION[campo];
  return enteroEntre(minimo, maximo).optional();
};

/**
 * E4-H06 (M9-H02 lo usa en el backoffice, FE-03): PATCH de los parámetros; lo que no llega se conserva y
 * montoEnvioGratis en null deja la tienda sin envío gratis. El monto viaja como texto (FE-10).
 */
export const actualizarConfiguracionSchema = z
  .object({
    diasGarantiaPrecio: enRango('diasGarantiaPrecio'),
    minutosReserva: enRango('minutosReserva'),
    horasCarritoAbandonado: enRango('horasCarritoAbandonado'),
    diasExpiracionCarritoInvitado: enRango('diasExpiracionCarritoInvitado'),
    umbralUltimasUnidades: enRango('umbralUltimasUnidades'),
    montoEnvioGratis: montoSchema
      .refine((valor) => !montoMenorOIgual(valor, '0'), 'Debe ser mayor que cero.')
      .nullable()
      .optional(),
    maxIntentosPagoRechazados: enRango('maxIntentosPagoRechazados'),
    diasPlazoDevolucion: enRango('diasPlazoDevolucion'),
    maxLineasCarrito: enRango('maxLineasCarrito'),
  })
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un parámetro.');

export type ActualizarConfiguracion = z.infer<typeof actualizarConfiguracionSchema>;
