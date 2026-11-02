import type { RequestHandler } from 'express';
import { montoATexto } from '../../shared/dinero/index.js';
import { manejar, paginar } from '../../shared/http/index.js';
import {
  actualizarCuponSchema,
  crearCuponSchema,
  listarCuponesSchema,
  paramsIdCuponSchema,
} from './cupones.schemas.js';
import type { CuponesService } from './cupones.service.js';
import type { Cupon } from './cupones.types.js';

const HTTP_CREADO = 201;

const aRespuesta = (cupon: Cupon) => ({
  ...cupon,
  valor: montoATexto(cupon.valor),
  montoMaximoDescuento:
    cupon.montoMaximoDescuento === null ? null : montoATexto(cupon.montoMaximoDescuento),
  montoMinimoCompra: montoATexto(cupon.montoMinimoCompra),
  fechaInicio: cupon.fechaInicio.toISOString(),
  fechaFin: cupon.fechaFin.toISOString(),
});

export interface CuponesController {
  listar: RequestHandler;
  obtener: RequestHandler;
  crear: RequestHandler;
  actualizar: RequestHandler;
  activar: RequestHandler;
  desactivar: RequestHandler;
}

export function crearCuponesController(servicio: CuponesService): CuponesController {
  return {
    listar: manejar({ query: listarCuponesSchema }, async ({ query }, res) => {
      const { filas, total } = await servicio.listar(query);
      res.json(paginar(filas.map(aRespuesta), total, query));
    }),

    obtener: manejar({ params: paramsIdCuponSchema }, async ({ params }, res) => {
      res.json({ datos: aRespuesta(await servicio.obtener(params.id)) });
    }),

    crear: manejar({ body: crearCuponSchema }, async ({ body }, res) => {
      res.status(HTTP_CREADO).json({ datos: aRespuesta(await servicio.crear(body)) });
    }),

    actualizar: manejar(
      { params: paramsIdCuponSchema, body: actualizarCuponSchema },
      async ({ params, body }, res) => {
        res.json({ datos: aRespuesta(await servicio.actualizar(params.id, body)) });
      },
    ),

    activar: manejar({ params: paramsIdCuponSchema }, async ({ params }, res) => {
      res.json({ datos: aRespuesta(await servicio.activar(params.id)) });
    }),

    desactivar: manejar({ params: paramsIdCuponSchema }, async ({ params }, res) => {
      res.json({ datos: aRespuesta(await servicio.desactivar(params.id)) });
    }),
  };
}
