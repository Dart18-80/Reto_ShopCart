import { z } from 'zod';

/** A-21: un monto viaja en JSON como texto con hasta 10 enteros y 2 decimales (DECIMAL(12,2)). */
export const montoSchema = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'El monto debe tener hasta 10 enteros y 2 decimales.');
