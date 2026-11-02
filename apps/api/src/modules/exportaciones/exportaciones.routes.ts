import { Router, type RequestHandler } from 'express';
import {
  autorizar,
  limitarIntentos,
  obtenerContexto,
  type LimitadorIntentos,
} from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { ExportacionesController } from './exportaciones.controller.js';
import {
  exportacionSchema,
  listarExportacionesSchema,
  paramsIdExportacionSchema,
  paramsReporteSchema,
  solicitarExportacionSchema,
} from './exportaciones.schemas.js';

const seguridad = [{ bearer: [] }];
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const archivoBinario = z.string().openapi({ type: 'string', format: 'binary' });
const reintentarEn = {
  'Retry-After': {
    description: 'Segundos para volver a consultar, mientras está Pendiente o Procesando',
    schema: { type: 'integer' as const },
  },
};

// Va después de autenticar: el usuario ya está en el contexto.
const porUsuario = (): string => String(obtenerContexto()?.idUsuario);

export function crearExportacionesRouter(
  controller: ExportacionesController,
  autenticar: RequestHandler,
  limitador: LimitadorIntentos,
): Router {
  const router = Router();
  const soloAdmin = [autenticar, autorizar('Administrador')];

  router.post(
    '/admin/reportes/:reporte/exportaciones',
    ...soloAdmin,
    limitarIntentos(limitador, porUsuario),
    controller.solicitar,
  );
  router.get('/admin/exportaciones', ...soloAdmin, controller.listar);
  router.get('/admin/exportaciones/:id', ...soloAdmin, controller.obtener);
  router.get('/admin/exportaciones/:id/archivo', ...soloAdmin, controller.descargar);
  return router;
}

registroOpenApi.registerPath({
  method: 'post',
  path: '/api/v1/admin/reportes/{reporte}/exportaciones',
  tags: ['Exportaciones'],
  summary:
    'Solicita la exportación de un reporte del dashboard a Excel o PDF (asíncrona). Los filtros son los del ' +
    'mismo reporte; una solicitud igual vigente devuelve la existente',
  security: seguridad,
  request: {
    params: paramsReporteSchema,
    body: json(solicitarExportacionSchema),
  },
  responses: {
    202: {
      description: 'Solicitud aceptada; Location apunta a su estado',
      headers: {
        ...reintentarEn,
        Location: {
          description: 'La URL del estado de la exportación',
          schema: { type: 'string' },
        },
      },
      ...json(z.object({ datos: exportacionSchema })),
    },
    ...respuestasError(400, 401, 403, 429),
  },
});
registroOpenApi.registerPath({
  method: 'get',
  path: '/api/v1/admin/exportaciones',
  tags: ['Exportaciones'],
  summary: 'Mis exportaciones (las más recientes primero)',
  security: seguridad,
  request: { query: listarExportacionesSchema },
  responses: {
    200: {
      description: 'Página de exportaciones',
      ...json(
        z.object({
          datos: z.array(exportacionSchema),
          paginacion: z.object({
            pagina: z.number().int(),
            tamano: z.number().int(),
            total: z.number().int(),
            totalPaginas: z.number().int(),
          }),
        }),
      ),
    },
    ...respuestasError(400, 401, 403),
  },
});
registroOpenApi.registerPath({
  method: 'get',
  path: '/api/v1/admin/exportaciones/{id}',
  tags: ['Exportaciones'],
  summary: 'El estado de una de mis exportaciones (una ajena responde 404)',
  security: seguridad,
  request: { params: paramsIdExportacionSchema },
  responses: {
    200: {
      description: 'La exportación',
      headers: reintentarEn,
      ...json(z.object({ datos: exportacionSchema })),
    },
    ...respuestasError(400, 401, 403, 404),
  },
});
registroOpenApi.registerPath({
  method: 'get',
  path: '/api/v1/admin/exportaciones/{id}/archivo',
  tags: ['Exportaciones'],
  summary: 'Descarga el archivo de una exportación Completada (por streaming)',
  security: seguridad,
  request: { params: paramsIdExportacionSchema },
  responses: {
    200: {
      description: 'El archivo, con Content-Disposition (el reporte y la fecha local)',
      content: {
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
          schema: archivoBinario,
        },
        'application/pdf': { schema: archivoBinario },
      },
    },
    ...respuestasError(400, 401, 403, 404, 409, 410),
  },
});
