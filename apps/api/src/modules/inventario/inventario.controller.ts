import type { RequestHandler } from 'express';
import { manejar } from '../../shared/http/index.js';
import {
  consultaExistenciasSchema,
  consultaKardexSchema,
  registrarAjusteSchema,
  registrarEntradaSchema,
} from './inventario.schemas.js';
import type { InventarioService } from './inventario.service.js';

const HTTP_CREADO = 201;

export interface InventarioController {
  registrarEntrada: RequestHandler;
  registrarAjuste: RequestHandler;
  obtenerKardex: RequestHandler;
  listarExistencias: RequestHandler;
  conciliar: RequestHandler;
  listarExistenciaBodega: RequestHandler;
}

export function crearInventarioController(servicio: InventarioService): InventarioController {
  return {
    registrarEntrada: manejar({ body: registrarEntradaSchema }, async ({ body }, res) => {
      res.status(HTTP_CREADO).json({ datos: await servicio.registrarEntrada(body) });
    }),

    registrarAjuste: manejar({ body: registrarAjusteSchema }, async ({ body }, res) => {
      res.status(HTTP_CREADO).json({ datos: await servicio.registrarAjuste(body) });
    }),

    obtenerKardex: manejar({ query: consultaKardexSchema }, async ({ query }, res) => {
      res.json(await servicio.obtenerKardex(query.variante, query));
    }),

    listarExistencias: manejar({ query: consultaExistenciasSchema }, async ({ query }, res) => {
      res.json(await servicio.listarExistencias(query.variante ?? null, query));
    }),

    conciliar: manejar({}, async (_entrada, res) => {
      res.json({ datos: await servicio.conciliar() });
    }),

    listarExistenciaBodega: manejar(
      { query: consultaExistenciasSchema },
      async ({ query }, res) => {
        res.json(await servicio.listarExistenciaBodega(query.variante ?? null, query));
      },
    ),
  };
}
