import { z } from 'zod';
import { enteroEntre } from './numeros.js';
import { montoSchema } from './monto.js';
import { textoNvarchar } from './texto.js';

// MetodoEnvio.DiasMin y DiasMax son TINYINT.
const DIAS_MAXIMOS = 255;
const diasSchema = enteroEntre(0, DIAS_MAXIMOS);

/**
 * N-04, E4-H06 (M9-H02 lo usa en el backoffice, FE-03): el PUT de un método de envío, la representación completa de
 * lo que el Admin puede cambiar; el código no cambia. El costo viaja como texto (FE-10).
 */
export const actualizarMetodoEnvioSchema = z
  .object({
    nombre: textoNvarchar(50),
    costo: montoSchema,
    diasMin: diasSchema,
    diasMax: diasSchema,
    activo: z.boolean(),
  })
  .strict()
  .refine((metodo) => metodo.diasMax >= metodo.diasMin, {
    message: 'Los días máximos no pueden ser menos que los mínimos.',
    path: ['diasMax'],
  });

export type ActualizarMetodoEnvio = z.infer<typeof actualizarMetodoEnvioSchema>;
