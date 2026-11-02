import type { RequestHandler } from 'express';
import type { Decimal } from 'decimal.js';
import { montoATexto } from '../../shared/dinero/index.js';
import { manejar, paginar } from '../../shared/http/index.js';
import {
  consultaCarritosSchema,
  consultaRangoSchema,
  consultaVentasSchema,
  encabezadosEventosSchema,
} from './reportes.schemas.js';
import type { ReportesService } from './reportes.service.js';
import type { TiempoRealService } from './reportes.tiempo-real.js';

// E9-H02: sin caché, sin buffering de nginx y con la conexión abierta.
const ENCABEZADOS_SSE = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

export interface ReportesController {
  resumen: RequestHandler;
  ventas: RequestHandler;
  ventasPorCategoria: RequestHandler;
  topProductos: RequestHandler;
  carritosAbandonados: RequestHandler;
  eventos: RequestHandler;
}

const conVentasEnTexto = <T extends { ventas: Decimal }>(fila: T) => ({
  ...fila,
  ventas: montoATexto(fila.ventas),
});

export function crearReportesController(
  servicio: ReportesService,
  tiempoReal: TiempoRealService,
): ReportesController {
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

    // Los encabezados salen con el primer evento: si el difusor rechaza la conexión (429), todavía se puede responder.
    eventos: manejar({ encabezados: encabezadosEventosSchema }, async ({ encabezados }, res) => {
      const desconectar = await tiempoReal.conectar(
        encabezados.authorization,
        encabezados['last-event-id'],
        {
          escribir: (texto) => {
            if (!res.headersSent) res.writeHead(200, ENCABEZADOS_SSE);
            res.write(texto);
          },
          cerrar: () => res.end(),
        },
      );
      res.on('close', desconectar);
      // El cliente pudo cerrar mientras se conectaba.
      if (res.closed) desconectar();
    }),
  };
}
