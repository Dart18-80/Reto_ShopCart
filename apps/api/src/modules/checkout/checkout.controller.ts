import type { RequestHandler } from 'express';
import { montoATexto } from '../../shared/dinero/index.js';
import { manejar } from '../../shared/http/index.js';
import { iniciarSesionSchema } from './checkout.schemas.js';
import type { CheckoutService } from './checkout.service.js';
import type { SesionPago } from './checkout.types.js';

const HTTP_OK = 200;
const HTTP_CREADO = 201;
const HTTP_SIN_CONTENIDO = 204;

const aRespuesta = (sesion: SesionPago) => ({
  ...sesion,
  expiraEn: sesion.expiraEn.toISOString(),
  envio: { ...sesion.envio, costo: montoATexto(sesion.envio.costo) },
  lineas: sesion.lineas.map((linea) => ({
    ...linea,
    precioUnitario: montoATexto(linea.precioUnitario),
    descuentoLinea: montoATexto(linea.descuentoLinea),
    totalLinea: montoATexto(linea.totalLinea),
  })),
  subtotal: montoATexto(sesion.subtotal),
  descuento: montoATexto(sesion.descuento),
  total: montoATexto(sesion.total),
});

export interface CheckoutController {
  iniciarSesion: RequestHandler;
  obtenerSesion: RequestHandler;
  cancelarSesion: RequestHandler;
}

export function crearCheckoutController(servicio: CheckoutService): CheckoutController {
  return {
    iniciarSesion: manejar({ body: iniciarSesionSchema }, async ({ body }, res) => {
      const { sesion, creada } = await servicio.iniciarSesion(body);
      res.status(creada ? HTTP_CREADO : HTTP_OK).json({ datos: aRespuesta(sesion) });
    }),

    obtenerSesion: manejar({}, async (_entrada, res) => {
      res.json({ datos: aRespuesta(await servicio.obtenerSesion()) });
    }),

    cancelarSesion: manejar({}, async (_entrada, res) => {
      await servicio.cancelarSesion();
      res.status(HTTP_SIN_CONTENIDO).end();
    }),
  };
}
