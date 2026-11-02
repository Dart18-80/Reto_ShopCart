import type { RequestHandler } from 'express';
import { manejar, obtenerContexto, paginar } from '../../shared/http/index.js';
import {
  pedidoARespuesta,
  resumenARespuesta,
  resumenGestionARespuesta,
} from './pedidos.respuesta.js';
import {
  cambiarEstadoSchema,
  listarPedidosGestionSchema,
  listarPedidosPropiosSchema,
  paramsIdPedidoSchema,
} from './pedidos.schemas.js';
import type { PedidosService } from './pedidos.service.js';

export interface PedidosController {
  listarPropios: RequestHandler;
  obtenerPropio: RequestHandler;
  listarGestion: RequestHandler;
  cambiarEstado: RequestHandler;
}

// autorizar() ya exigió un rol de gestión: aquí solo se lee del contexto de la petición.
function rolDeLaPeticion() {
  const rol = obtenerContexto()?.rol;
  if (rol === undefined || rol === null)
    throw new Error('La ruta de gestión no tiene rol autenticado');
  return rol;
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

    cambiarEstado: manejar(
      { params: paramsIdPedidoSchema, body: cambiarEstadoSchema },
      async ({ params, body }, res) => {
        const pedido = await servicio.cambiarEstado(params.id, body, rolDeLaPeticion());
        res.json({ datos: pedidoARespuesta(pedido) });
      },
    ),
  };
}
