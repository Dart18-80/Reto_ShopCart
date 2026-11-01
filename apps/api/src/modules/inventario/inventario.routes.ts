import { Router, type RequestHandler } from 'express';
import { autorizar } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { InventarioController } from './inventario.controller.js';
import {
  consultaExistenciasSchema,
  consultaKardexSchema,
  descuadreSchema,
  existenciaBodegaSchema,
  existenciaSchema,
  movimientoSchema,
  registrarAjusteSchema,
  registrarEntradaSchema,
} from './inventario.schemas.js';

const RUTA = '/api/v1/inventario';
const seguridad = [{ bearer: [] }];
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const paginacionSchema = z.object({
  pagina: z.number().int(),
  tamano: z.number().int(),
  total: z.number().int(),
  totalPaginas: z.number().int(),
});
const listado = (descripcion: string, schema: z.ZodType) => ({
  description: descripcion,
  ...json(z.object({ datos: z.array(schema), paginacion: paginacionSchema })),
});
const movimiento = (descripcion: string) => ({
  description: descripcion,
  ...json(z.object({ datos: movimientoSchema })),
});

registroOpenApi.registerPath({
  method: 'post',
  path: `${RUTA}/entradas`,
  tags: ['Inventario'],
  summary:
    'Registra una entrada con motivo obligatorio y referencia opcional (Operador o Admin; N-16)',
  security: seguridad,
  request: { body: json(registrarEntradaSchema) },
  responses: { 201: movimiento('Movimiento registrado'), ...respuestasError(400, 401, 403, 404) },
});
registroOpenApi.registerPath({
  method: 'post',
  path: `${RUTA}/ajustes`,
  tags: ['Inventario'],
  summary:
    'Ajusta la existencia con motivo obligatorio; nunca en negativo ni por debajo de lo reservado (Operador o Admin; N-07)',
  security: seguridad,
  request: { body: json(registrarAjusteSchema) },
  responses: {
    201: movimiento('Movimiento registrado'),
    ...respuestasError(400, 401, 403, 404, 422),
  },
});
registroOpenApi.registerPath({
  method: 'get',
  path: `${RUTA}/kardex`,
  tags: ['Inventario'],
  summary: 'Kardex de una variante, del movimiento más reciente al más antiguo (Operador o Admin)',
  security: seguridad,
  request: { query: consultaKardexSchema },
  responses: {
    200: listado('Movimientos', movimientoSchema),
    ...respuestasError(400, 401, 403, 404),
  },
});
registroOpenApi.registerPath({
  method: 'get',
  path: `${RUTA}/existencias`,
  tags: ['Inventario'],
  summary: 'Existencia física, reservada y disponible por variante (Operador o Admin)',
  security: seguridad,
  request: { query: consultaExistenciasSchema },
  responses: { 200: listado('Existencias', existenciaSchema), ...respuestasError(400, 401, 403) },
});
registroOpenApi.registerPath({
  method: 'get',
  path: `${RUTA}/conciliacion`,
  tags: ['Inventario'],
  summary:
    'Variantes cuya existencia no cuadra con el kardex; debe estar vacía (Operador o Admin; N-07)',
  security: seguridad,
  responses: {
    200: { description: 'Descuadres', ...json(z.object({ datos: z.array(descuadreSchema) })) },
    ...respuestasError(401, 403),
  },
});
registroOpenApi.registerPath({
  method: 'get',
  path: `${RUTA}/bodega`,
  tags: ['Inventario'],
  summary:
    'Existencia en bodega: física más unidades pagadas por despachar (Operador o Admin; N-07)',
  security: seguridad,
  request: { query: consultaExistenciasSchema },
  responses: {
    200: listado('Existencia en bodega', existenciaBodegaSchema),
    ...respuestasError(400, 401, 403),
  },
});

export function crearInventarioRouter(
  controller: InventarioController,
  autenticar: RequestHandler,
): Router {
  const router = Router();
  router.use(autenticar, autorizar('Operador', 'Administrador'));

  router.post('/entradas', controller.registrarEntrada);
  router.post('/ajustes', controller.registrarAjuste);
  router.get('/kardex', controller.obtenerKardex);
  router.get('/existencias', controller.listarExistencias);
  router.get('/conciliacion', controller.conciliar);
  router.get('/bodega', controller.listarExistenciaBodega);
  return router;
}
