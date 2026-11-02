import type { RequestHandler } from 'express';
import { montoATexto } from '../../shared/dinero/index.js';
import { encabezadoIdempotenciaSchema, manejar } from '../../shared/http/index.js';
import { pedidoARespuesta } from '../pedidos/index.js';
import type { PagoService } from './checkout.pago.js';
import { iniciarSesionSchema, pagarSchema } from './checkout.schemas.js';
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
  pagar: RequestHandler;
}

export function crearCheckoutController(
  servicio: CheckoutService,
  pago: PagoService,
): CheckoutController {
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

    pagar: manejar(
      { body: pagarSchema, encabezados: encabezadoIdempotenciaSchema },
      async ({ body, encabezados }, res) => {
        const { pedido, creado } = await pago.pagar({
          llave: encabezados['idempotency-key'],
          tarjeta: {
            numero: body.numeroTarjeta,
            mesVencimiento: body.mesVencimiento,
            anioVencimiento: body.anioVencimiento,
            cvv: body.cvv,
          },
        });
        res.status(creado ? HTTP_CREADO : HTTP_OK).json({ datos: pedidoARespuesta(pedido) });
      },
    ),
  };
}
