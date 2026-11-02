import type { RequestHandler } from 'express';
import type { Decimal } from 'decimal.js';
import { montoATexto } from '../../shared/dinero/index.js';
import { manejar, paginar } from '../../shared/http/index.js';
import {
  consultaCarritosSchema,
  consultaRangoSchema,
  consultaVentasSchema,
} from './reportes.schemas.js';
import type { ReportesService } from './reportes.service.js';

export interface ReportesController {
  resumen: RequestHandler;
  ventas: RequestHandler;
  ventasPorCategoria: RequestHandler;
  topProductos: RequestHandler;
  carritosAbandonados: RequestHandler;
}

const conVentasEnTexto = <T extends { ventas: Decimal }>(fila: T) => ({
  ...fila,
  ventas: montoATexto(fila.ventas),
});

export function crearReportesController(servicio: ReportesService): ReportesController {
  return {
    resumen: manejar({ query: consultaRangoSchema }, async ({ query }, res) => {
      const resumen = await servicio.resumen(query);
      res.json({
        datos: {
          ...resumen,
          ventas: montoATexto(resumen.ventas),
          ticketPromedio: montoATexto(resumen.ticketPromedio),
          devoluciones: montoATexto(resumen.devoluciones),
          envio: montoATexto(resumen.envio),
          montoPotencialPerdido: montoATexto(resumen.montoPotencialPerdido),
        },
      });
    }),

    ventas: manejar({ query: consultaVentasSchema }, async ({ query }, res) => {
      res.json({ datos: (await servicio.ventasPorPeriodo(query)).map(conVentasEnTexto) });
    }),

    ventasPorCategoria: manejar({ query: consultaRangoSchema }, async ({ query }, res) => {
      res.json({ datos: (await servicio.ventasPorCategoria(query)).map(conVentasEnTexto) });
    }),

    topProductos: manejar({ query: consultaRangoSchema }, async ({ query }, res) => {
      res.json({ datos: (await servicio.topProductos(query)).map(conVentasEnTexto) });
    }),

    carritosAbandonados: manejar({ query: consultaCarritosSchema }, async ({ query }, res) => {
      const { filas, total } = await servicio.carritosAbandonados(query);
      const datos = filas.map((carrito) => ({
        ...carrito,
        fechaUltimaActividad: carrito.fechaUltimaActividad.toISOString(),
        montoPotencial: montoATexto(carrito.montoPotencial),
      }));
      res.json(paginar(datos, total, query));
    }),
  };
}
