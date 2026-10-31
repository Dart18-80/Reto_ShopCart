import type { RequestHandler } from 'express';
import { manejar } from '../../shared/http/index.js';
import {
  actualizarDireccionSchema,
  crearDireccionSchema,
  paramsIdDepartamentoSchema,
  paramsIdDireccionSchema,
} from './direcciones.schemas.js';
import type { DireccionesService } from './direcciones.service.js';

const HTTP_CREADO = 201;
const HTTP_SIN_CONTENIDO = 204;

export interface DireccionesController {
  listar: RequestHandler;
  obtener: RequestHandler;
  crear: RequestHandler;
  actualizar: RequestHandler;
  eliminar: RequestHandler;
  listarDepartamentos: RequestHandler;
  listarMunicipios: RequestHandler;
}

export function crearDireccionesController(servicio: DireccionesService): DireccionesController {
  return {
    listar: manejar({}, async (_entrada, res) => {
      res.json({ datos: await servicio.listar() });
    }),

    obtener: manejar({ params: paramsIdDireccionSchema }, async ({ params }, res) => {
      res.json({ datos: await servicio.obtener(params.id) });
    }),

    crear: manejar({ body: crearDireccionSchema }, async ({ body }, res) => {
      res.status(HTTP_CREADO).json({ datos: await servicio.crear(body) });
    }),

    actualizar: manejar(
      { params: paramsIdDireccionSchema, body: actualizarDireccionSchema },
      async ({ params, body }, res) => {
        res.json({ datos: await servicio.actualizar(params.id, body) });
      },
    ),

    eliminar: manejar({ params: paramsIdDireccionSchema }, async ({ params }, res) => {
      await servicio.eliminar(params.id);
      res.status(HTTP_SIN_CONTENIDO).end();
    }),

    listarDepartamentos: manejar({}, async (_entrada, res) => {
      res.json({ datos: await servicio.listarDepartamentos() });
    }),

    listarMunicipios: manejar({ params: paramsIdDepartamentoSchema }, async ({ params }, res) => {
      res.json({ datos: await servicio.listarMunicipios(params.id) });
    }),
  };
}
