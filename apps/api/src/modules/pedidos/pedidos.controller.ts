import type { RequestHandler } from 'express';
import { manejar, paginar } from '../../shared/http/index.js';
import {
  pedidoARespuesta,
  resumenARespuesta,
  resumenGestionARespuesta,
} from './pedidos.respuesta.js';
import {
  listarPedidosGestionSchema,
  listarPedidosPropiosSchema,
  paramsIdPedidoSchema,
} from './pedidos.schemas.js';
import type { PedidosService } from './pedidos.service.js';

export interface PedidosController {
  listarPropios: RequestHandler;
  obtenerPropio: RequestHandler;
  listarGestion: RequestHandler;
}

export function crearPedidosController(servicio: PedidosService): PedidosController {
  return {
    listarPropios: manejar({ query: listarPedidosPropiosSchema }, async ({ query }, res) => {
      const { filas, total } = await servicio.listarPropios(query);
      res.json(paginar(filas.map(resumenARespuesta), total, query));
    }),

    obtenerPropio: manejar({ params: paramsIdPedidoSchema }, async ({ params }, res) => {
      res.json({ datos: pedidoARespuesta(await servicio.obtenerPropio(params.id)) });
    }),

    listarGestion: manejar({ query: listarPedidosGestionSchema }, async ({ query }, res) => {
      const { filas, total } = await servicio.listarGestion(query);
      res.json(paginar(filas.map(resumenGestionARespuesta), total, query));
    }),
  };
}
