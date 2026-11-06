import type { RequestHandler } from 'express';
import { encabezadoIdempotenciaOpcionalSchema, manejar } from '../../shared/http/index.js';
import {
  consultaExistenciasSchema,
  listarExistenciasSchema,
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
    registrarEntrada: manejar(
      { body: registrarEntradaSchema, encabezados: encabezadoIdempotenciaOpcionalSchema },
      async ({ body, encabezados }, res) => {
        const movimiento = await servicio.registrarEntrada(body, encabezados['idempotency-key']);
        res.status(HTTP_CREADO).json({ datos: movimiento });
      },
    ),

    registrarAjuste: manejar(
      { body: registrarAjusteSchema, encabezados: encabezadoIdempotenciaOpcionalSchema },
      async ({ body, encabezados }, res) => {
        const movimiento = await servicio.registrarAjuste(body, encabezados['idempotency-key']);
        res.status(HTTP_CREADO).json({ datos: movimiento });
      },
    ),

    obtenerKardex: manejar({ query: consultaKardexSchema }, async ({ query }, res) => {
      res.json(await servicio.obtenerKardex(query.variante, query));
    }),

    listarExistencias: manejar({ query: listarExistenciasSchema }, async ({ query }, res) => {
      res.json(await servicio.listarExistencias(query.variante ?? null, query, query));
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
