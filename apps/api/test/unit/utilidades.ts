import type { Response } from 'supertest';
import { z } from 'zod';

const respuestaErrorSchema = z.object({
  error: z.object({
    codigo: z.string(),
    mensaje: z.string(),
    detalles: z.unknown().optional(),
    requestId: z.string(),
  }),
});

const respuestaDatosSchema = z.object({ datos: z.unknown() });

/** supertest tipa el cuerpo como `any`: se valida con Zod para trabajar con tipos reales. */
export function leerError(respuesta: Response): z.infer<typeof respuestaErrorSchema>['error'] {
  return respuestaErrorSchema.parse(respuesta.body).error;
}

export function leerDatos<T>(respuesta: Response, esquema: z.ZodType<T>): T {
  return esquema.parse(respuestaDatosSchema.parse(respuesta.body).datos);
}
