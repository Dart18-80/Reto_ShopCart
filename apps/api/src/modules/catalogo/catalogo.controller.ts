import type { RequestHandler } from 'express';
import { manejar } from '../../shared/http/index.js';
import {
  actualizarCategoriaSchema,
  crearCategoriaSchema,
  paramsIdCategoriaSchema,
} from './catalogo.schemas.js';
import type { CatalogoService } from './catalogo.service.js';

const HTTP_CREADO = 201;
const HTTP_SIN_CONTENIDO = 204;

export interface CatalogoController {
  listarCategorias: RequestHandler;
  crearCategoria: RequestHandler;
  actualizarCategoria: RequestHandler;
  activarCategoria: RequestHandler;
  desactivarCategoria: RequestHandler;
  eliminarCategoria: RequestHandler;
}

export function crearCatalogoController(servicio: CatalogoService): CatalogoController {
  return {
    listarCategorias: manejar({}, async (_entrada, res) => {
      res.json({ datos: await servicio.listarCategorias() });
    }),

    crearCategoria: manejar({ body: crearCategoriaSchema }, async ({ body }, res) => {
      res.status(HTTP_CREADO).json({ datos: await servicio.crearCategoria(body) });
    }),

    actualizarCategoria: manejar(
      { params: paramsIdCategoriaSchema, body: actualizarCategoriaSchema },
      async ({ params, body }, res) => {
        res.json({ datos: await servicio.actualizarCategoria(params.id, body) });
      },
    ),

    activarCategoria: manejar({ params: paramsIdCategoriaSchema }, async ({ params }, res) => {
      res.json({ datos: await servicio.activarCategoria(params.id) });
    }),

    desactivarCategoria: manejar({ params: paramsIdCategoriaSchema }, async ({ params }, res) => {
      res.json({ datos: await servicio.desactivarCategoria(params.id) });
    }),

    eliminarCategoria: manejar({ params: paramsIdCategoriaSchema }, async ({ params }, res) => {
      await servicio.eliminarCategoria(params.id);
      res.status(HTTP_SIN_CONTENIDO).end();
    }),
  };
}
