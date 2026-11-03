import type { RequestHandler } from 'express';
import { manejar, obtenerContexto, paginar } from '../../shared/http/index.js';
import type { ReembolsosService } from './pedidos.reembolsos.js';
import {
  cancelacionARespuesta,
  devolucionARespuesta,
  pagoEnRevisionARespuesta,
  pedidoARespuesta,
  reembolsoARespuesta,
  resolucionPagoARespuesta,
  resumenARespuesta,
  resumenGestionARespuesta,
} from './pedidos.respuesta.js';
import {
  cambiarEstadoSchema,
  cancelarPedidoSchema,
  listarPagosEnRevisionSchema,
  listarReembolsosSchema,
  paramsIdIntentoSchema,
  paramsIdReembolsoSchema,
  resolverPagoSchema,
  resolverReembolsoSchema,
  listarPedidosGestionSchema,
  listarPedidosPropiosSchema,
  paramsIdPedidoSchema,
  registrarDevolucionSchema,
} from './pedidos.schemas.js';
import type { RevisionService } from './pedidos.revision.js';
import type { PedidosService } from './pedidos.service.js';

const HTTP_CREADO = 201;

export interface PedidosController {
  listarPropios: RequestHandler;
  obtenerPropio: RequestHandler;
  listarGestion: RequestHandler;
  cambiarEstado: RequestHandler;
  cancelar: RequestHandler;
  registrarDevolucion: RequestHandler;
  listarReembolsos: RequestHandler;
  reintentarReembolso: RequestHandler;
  resolverReembolso: RequestHandler;
  listarPagosEnRevision: RequestHandler;
  resolverPago: RequestHandler;
}

// autorizar() ya exigió un rol de gestión: aquí solo se lee del contexto de la petición.
function rolDeLaPeticion() {
  const rol = obtenerContexto()?.rol;
  if (rol === undefined || rol === null)
    throw new Error('La ruta de gestión no tiene rol autenticado');
  return rol;
}

export function crearPedidosController(
  servicio: PedidosService,
  reembolsos: ReembolsosService,
  revision: RevisionService,
): PedidosController {
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

    // El Cliente cancela los suyos (uno ajeno responde 404 desde el SP); la gestión, cualquiera.
    cancelar: manejar(
      { params: paramsIdPedidoSchema, body: cancelarPedidoSchema },
      async ({ params, body }, res) => {
        const cancelacion = await reembolsos.cancelar(params.id, body.motivo);
        res.json({ datos: cancelacionARespuesta(cancelacion) });
      },
    ),

    registrarDevolucion: manejar(
      { params: paramsIdPedidoSchema, body: registrarDevolucionSchema },
      async ({ params, body }, res) => {
        const devolucion = await reembolsos.registrarDevolucion(params.id, body);
        res.status(HTTP_CREADO).json({ datos: devolucionARespuesta(devolucion) });
      },
    ),

    listarReembolsos: manejar({ query: listarReembolsosSchema }, async ({ query }, res) => {
      const { filas, total } = await reembolsos.listar(query);
      res.json(paginar(filas.map(reembolsoARespuesta), total, query));
    }),

    reintentarReembolso: manejar({ params: paramsIdReembolsoSchema }, async ({ params }, res) => {
      const estado = await reembolsos.reintentar(params.id);
      res.json({ datos: { idReembolso: params.id, estado } });
    }),

    resolverReembolso: manejar(
      { params: paramsIdReembolsoSchema, body: resolverReembolsoSchema },
      async ({ params, body }, res) => {
        res.json({ datos: reembolsoARespuesta(await revision.resolverReembolso(params.id, body)) });
      },
    ),

    listarPagosEnRevision: manejar(
      { query: listarPagosEnRevisionSchema },
      async ({ query }, res) => {
        const { filas, total } = await revision.listarPagosEnRevision(query);
        res.json(paginar(filas.map(pagoEnRevisionARespuesta), total, query));
      },
    ),

    resolverPago: manejar(
      { params: paramsIdIntentoSchema, body: resolverPagoSchema },
      async ({ params, body }, res) => {
        res.json({ datos: resolucionPagoARespuesta(await revision.resolverPago(params.id, body)) });
      },
    ),
  };
}
