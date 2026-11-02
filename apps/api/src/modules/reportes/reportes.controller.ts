import type { RequestHandler } from 'express';
import type { Decimal } from 'decimal.js';
import { montoATexto } from '../../shared/dinero/index.js';
import { manejar, paginar } from '../../shared/http/index.js';
import type { ReportesRepository } from './reportes.repository.js';
import {
  consultaCarritosSchema,
  consultaRangoSchema,
  consultaVentasSchema,
} from './reportes.schemas.js';

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

// Los reportes no tienen reglas propias: el SP agrega sobre la definición única de venta (M-07). Sin
// servicio intermedio que solo reenvíe (KISS): el controlador traduce HTTP ↔ repositorio.
export function crearReportesController(repositorio: ReportesRepository): ReportesController {
  return {
    resumen: manejar({ query: consultaRangoSchema }, async ({ query }, res) => {
      const resumen = await repositorio.resumen(query);
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
      res.json({ datos: (await repositorio.ventasPorPeriodo(query)).map(conVentasEnTexto) });
    }),

    ventasPorCategoria: manejar({ query: consultaRangoSchema }, async ({ query }, res) => {
      res.json({ datos: (await repositorio.ventasPorCategoria(query)).map(conVentasEnTexto) });
    }),

    topProductos: manejar({ query: consultaRangoSchema }, async ({ query }, res) => {
      res.json({ datos: (await repositorio.topProductos(query)).map(conVentasEnTexto) });
    }),

    carritosAbandonados: manejar({ query: consultaCarritosSchema }, async ({ query }, res) => {
      const { filas, total } = await repositorio.carritosAbandonados(query);
      const datos = filas.map((carrito) => ({
        ...carrito,
        fechaUltimaActividad: carrito.fechaUltimaActividad.toISOString(),
        montoPotencial: montoATexto(carrito.montoPotencial),
      }));
      res.json(paginar(datos, total, query));
    }),
  };
}
