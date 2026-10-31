import { Router, type RequestHandler } from 'express';
import { autorizar } from '../../shared/http/index.js';
import { registroOpenApi, respuestasError } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import type { DireccionesController } from './direcciones.controller.js';
import {
  actualizarDireccionSchema,
  crearDireccionSchema,
  direccionSchema,
  listaDepartamentosSchema,
  listaMunicipiosSchema,
  paramsIdDepartamentoSchema,
  paramsIdDireccionSchema,
} from './direcciones.schemas.js';

const RUTA = '/api/v1/direcciones';
const seguridad = [{ bearer: [] }];
const json = (schema: z.ZodType) => ({ content: { 'application/json': { schema } } });
const respuestaDireccion = (descripcion: string) => ({
  description: descripcion,
  ...json(z.object({ datos: direccionSchema })),
});

registroOpenApi.registerPath({
  method: 'get',
  path: RUTA,
  tags: ['Direcciones'],
  summary: 'Direcciones del cliente de la sesión (la predeterminada primero)',
  security: seguridad,
  responses: {
    200: { description: 'Direcciones', ...json(z.object({ datos: z.array(direccionSchema) })) },
    ...respuestasError(401, 403),
  },
});
registroOpenApi.registerPath({
  method: 'post',
  path: RUTA,
  tags: ['Direcciones'],
  summary: 'Agrega una dirección (máximo 10; una sola predeterminada)',
  security: seguridad,
  request: { body: json(crearDireccionSchema) },
  responses: {
    201: respuestaDireccion('Dirección creada'),
    ...respuestasError(400, 401, 403, 422),
  },
});
registroOpenApi.registerPath({
  method: 'get',
  path: `${RUTA}/{id}`,
  tags: ['Direcciones'],
  summary: 'Una dirección propia (una ajena responde 404, RF-01)',
  security: seguridad,
  request: { params: paramsIdDireccionSchema },
  responses: { 200: respuestaDireccion('Dirección'), ...respuestasError(401, 403, 404) },
});
registroOpenApi.registerPath({
  method: 'patch',
  path: `${RUTA}/{id}`,
  tags: ['Direcciones'],
  summary: 'Edita una dirección propia (alias y referencia en null se quitan)',
  security: seguridad,
  request: { params: paramsIdDireccionSchema, body: json(actualizarDireccionSchema) },
  responses: {
    200: respuestaDireccion('Dirección actualizada'),
    ...respuestasError(400, 401, 403, 404),
  },
});
registroOpenApi.registerPath({
  method: 'delete',
  path: `${RUTA}/{id}`,
  tags: ['Direcciones'],
  summary: 'Elimina una dirección propia (los pedidos guardan su copia)',
  security: seguridad,
  request: { params: paramsIdDireccionSchema },
  responses: { 204: { description: 'Dirección eliminada' }, ...respuestasError(401, 403, 404) },
});
registroOpenApi.registerPath({
  method: 'get',
  path: '/api/v1/departamentos',
  tags: ['Direcciones'],
  summary: 'Los 22 departamentos de Guatemala',
  responses: { 200: { description: 'Departamentos', ...json(listaDepartamentosSchema) } },
});
registroOpenApi.registerPath({
  method: 'get',
  path: '/api/v1/departamentos/{id}/municipios',
  tags: ['Direcciones'],
  summary: 'Los municipios de un departamento',
  request: { params: paramsIdDepartamentoSchema },
  responses: {
    200: { description: 'Municipios', ...json(listaMunicipiosSchema) },
    ...respuestasError(404),
  },
});

export function crearDireccionesRouter(
  controller: DireccionesController,
  autenticar: RequestHandler,
): Router {
  const router = Router();
  const soloCliente = [autenticar, autorizar('Cliente')];

  router.get('/direcciones', ...soloCliente, controller.listar);
  router.post('/direcciones', ...soloCliente, controller.crear);
  router.get('/direcciones/:id', ...soloCliente, controller.obtener);
  router.patch('/direcciones/:id', ...soloCliente, controller.actualizar);
  router.delete('/direcciones/:id', ...soloCliente, controller.eliminar);

  // Públicas: el catálogo geográfico (N-17) no tiene datos personales y lo usa el formulario de dirección.
  router.get('/departamentos', controller.listarDepartamentos);
  router.get('/departamentos/:id/municipios', controller.listarMunicipios);
  return router;
}
