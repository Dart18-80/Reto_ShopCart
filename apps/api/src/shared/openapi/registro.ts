import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { z } from './zod.js';

/** Cada archivo de rutas registra aquí sus endpoints (A-08). */
export const registroOpenApi = new OpenAPIRegistry();

const errorSchema = registroOpenApi.register(
  'Error',
  z.object({
    error: z.object({
      codigo: z.string().openapi({ example: 'PARAMETRO_INVALIDO' }),
      mensaje: z.string().openapi({ example: 'Los datos enviados no son válidos.' }),
      detalles: z.unknown().optional(),
      requestId: z.uuid(),
    }),
  }),
);

const DESCRIPCIONES: Record<number, string> = {
  400: 'Datos inválidos',
  401: 'Sin sesión o token inválido',
  403: 'El rol no tiene permiso',
  404: 'No existe o pertenece a otro cliente',
  409: 'Conflicto de estado',
  422: 'Regla de negocio incumplida',
  429: 'Demasiadas peticiones',
  500: 'Error inesperado',
  503: 'Servicio no disponible',
};

/** Respuestas de error estándar para registerPath: `...respuestasError(400, 401)`. */
export function respuestasError(...estados: number[]) {
  return Object.fromEntries(
    estados.map((estado) => [
      estado,
      {
        description: DESCRIPCIONES[estado] ?? 'Error',
        content: { 'application/json': { schema: errorSchema } },
      },
    ]),
  );
}

export type DocumentoOpenApi = ReturnType<OpenApiGeneratorV31['generateDocument']>;

export function generarDocumentoOpenApi(): DocumentoOpenApi {
  return new OpenApiGeneratorV31(registroOpenApi.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'ShopCart API',
      version: '1.0.0',
      description: 'API REST de ShopCart. Todos los errores usan el formato `Error`.',
    },
    servers: [{ url: '/' }],
  });
}
