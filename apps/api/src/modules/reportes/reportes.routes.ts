import { Router, type RequestHandler } from 'express';
import { autorizar } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { ReportesController } from './reportes.controller.js';
import {
  carritoAbandonadoSchema,
  consultaCarritosSchema,
  consultaRangoSchema,
  consultaVentasSchema,
  productoVendidoSchema,
  resumenSchema,
  ventasDeCategoriaSchema,
  ventasDelPeriodoSchema,
} from './reportes.schemas.js';

const RUTA = '/api/v1/dashboard';
const seguridad = [{ bearer: [] }];
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const DEFINICION =
  'Venta = pedido no cancelado en su día de pago de Guatemala; monto = productos con IVA sin envío; las devoluciones se restan en su propia fecha (N-11). Sin rango: los últimos 30 días.';

const reporte = (
  ruta: string,
  resumen: string,
  query: z.ZodObject,
  respuesta: z.ZodType,
  descripcion: string,
) => {
  registroOpenApi.registerPath({
    method: 'get',
    path: `${RUTA}${ruta}`,
    tags: ['Dashboard'],
    summary: resumen,
    description: DEFINICION,
    security: seguridad,
    request: { query },
    responses: {
      200: { description: descripcion, ...json(respuesta) },
      ...respuestasError(400, 401, 403),
    },
  });
};

reporte(
  '/resumen',
  'Ventas, pedidos, ticket promedio, devoluciones, envío y carritos abandonados del periodo',
  consultaRangoSchema,
  z.object({ datos: resumenSchema }),
  'El resumen',
);
reporte(
  '/ventas',
  'Ventas y pedidos por día, semana (desde el lunes) o mes',
  consultaVentasSchema,
  z.object({ datos: z.array(ventasDelPeriodoSchema) }),
  'Un periodo por fila, en orden',
);
reporte(
  '/ventas-por-categoria',
  'Ventas y unidades por categoría, de mayor a menor',
  consultaRangoSchema,
  z.object({ datos: z.array(ventasDeCategoriaSchema) }),
  'Una categoría por fila',
);
reporte(
  '/top-productos',
  'Los 10 productos más vendidos por unidades',
  consultaRangoSchema,
  z.object({ datos: z.array(productoVendidoSchema) }),
  'Hasta 10 productos',
);
reporte(
  '/carritos-abandonados',
  'Carritos abandonados (N-13) cuya última actividad cae en el periodo, con su monto potencial perdido',
  consultaCarritosSchema,
  z.object({
    datos: z.array(carritoAbandonadoSchema),
    paginacion: z.object({
      pagina: z.number().int(),
      tamano: z.number().int(),
      total: z.number().int(),
      totalPaginas: z.number().int(),
    }),
  }),
  'Página de carritos',
);

export function crearReportesRouter(
  controller: ReportesController,
  autenticar: RequestHandler,
): Router {
  const router = Router();
  const soloAdmin = [autenticar, autorizar('Administrador')];

  router.get('/dashboard/resumen', ...soloAdmin, controller.resumen);
  router.get('/dashboard/ventas', ...soloAdmin, controller.ventas);
  router.get('/dashboard/ventas-por-categoria', ...soloAdmin, controller.ventasPorCategoria);
  router.get('/dashboard/top-productos', ...soloAdmin, controller.topProductos);
  router.get('/dashboard/carritos-abandonados', ...soloAdmin, controller.carritosAbandonados);
  return router;
}
