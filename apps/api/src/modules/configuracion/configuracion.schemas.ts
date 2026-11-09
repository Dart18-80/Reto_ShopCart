import {
  actualizarConfiguracionSchema as actualizarConfiguracionCompartido,
  montoSchema,
} from '@shopcart/shared';
import { Decimal } from 'decimal.js';
import { registroOpenApi } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';

// M9-H02 (FE-03): el PATCH vive en @shopcart/shared. La ruta documenta el esquema compartido; el controlador valida
// con la versión de entrada, que además pasa el monto del envío gratis a Decimal (A-21).
export const actualizarConfiguracionSchema = registroOpenApi.register(
  'ActualizarConfiguracion',
  actualizarConfiguracionCompartido,
);
export const actualizarConfiguracionEntradaSchema = actualizarConfiguracionSchema.transform(
  ({ montoEnvioGratis, ...resto }) => ({
    ...resto,
    ...(montoEnvioGratis === undefined
      ? {}
      : { montoEnvioGratis: montoEnvioGratis === null ? null : new Decimal(montoEnvioGratis) }),
  }),
);

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

export type ActualizarConfiguracion = z.output<typeof actualizarConfiguracionEntradaSchema>;
