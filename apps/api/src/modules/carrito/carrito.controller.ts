import type { CookieOptions, RequestHandler, Response } from 'express';
import { montoATexto } from '../../shared/dinero/index.js';
import { manejar, obtenerContexto, type ClienteHttp } from '../../shared/http/index.js';
import {
  actualizarCantidadSchema,
  agregarLineaSchema,
  aplicarCuponSchema,
  COOKIE_CARRITO,
  cookiesCarritoSchema,
  paramsIdLineaSchema,
} from './carrito.schemas.js';
import type { CarritoService } from './carrito.service.js';
import type { Carrito, Comprador } from './carrito.types.js';

// N-05: la cookie viaja a toda la API (también al login de la fusión y a los envíos), nunca fuera de ella.
export const RUTA_COOKIE_CARRITO = '/api/v1';
// La vida real del carrito la decide la base (DiasExpiracionCarritoInvitado, hasta 365 días sin actividad).
const DIAS_VIDA_COOKIE = 365;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

const aRespuesta = (carrito: Carrito) => ({
  lineas: carrito.lineas.map((linea) => ({
    ...linea,
    precioUnitario: montoATexto(linea.precioUnitario),
    totalLinea: montoATexto(linea.totalLinea),
    descuentoLinea: montoATexto(linea.descuentoLinea),
    garantiaHasta: linea.garantiaHasta.toISOString(),
    aviso:
      linea.aviso === null
        ? null
        : {
            tipo: linea.aviso.tipo,
            precioAnterior:
              linea.aviso.precioAnterior === null ? null : montoATexto(linea.aviso.precioAnterior),
          },
  })),
  resumen: {
    ...carrito.resumen,
    subtotal: montoATexto(carrito.resumen.subtotal),
    descuento: montoATexto(carrito.resumen.descuento),
    total: montoATexto(carrito.resumen.total),
    envioGratis:
      carrito.resumen.envioGratis === null
        ? null
        : {
            montoMinimo: montoATexto(carrito.resumen.envioGratis.montoMinimo),
            faltante: montoATexto(carrito.resumen.envioGratis.faltante),
            alcanzado: carrito.resumen.envioGratis.alcanzado,
          },
  },
});

/** N-05: con sesión (solo un Cliente llega aquí) manda su carrito; sin sesión, el de la cookie. */
function compradorDe(token: string | undefined, cliente: ClienteHttp): Comprador {
  return obtenerContexto()?.idUsuario == null
    ? { tipo: 'invitado', token, ip: cliente.ip }
    : { tipo: 'cliente' };
}

export interface CarritoController {
  obtener: RequestHandler;
  agregarLinea: RequestHandler;
  actualizarCantidad: RequestHandler;
  eliminarLinea: RequestHandler;
  marcarAvisosVistos: RequestHandler;
  aplicarCupon: RequestHandler;
  quitarCupon: RequestHandler;
}

export function crearCarritoController(
  servicio: CarritoService,
  cookiesSeguras: boolean,
): CarritoController {
  // N-05: httpOnly y SameSite=Lax; Secure fuera de desarrollo. El token nunca se registra en logs.
  const opcionesCookie: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookiesSeguras,
    path: RUTA_COOKIE_CARRITO,
  };

  function enviarCarrito(res: Response, carrito: Carrito, tokenNuevo: string | null = null): void {
    if (tokenNuevo !== null) {
      res.cookie(COOKIE_CARRITO, tokenNuevo, {
        ...opcionesCookie,
        maxAge: DIAS_VIDA_COOKIE * MS_POR_DIA,
      });
    }
    res.json({ datos: aRespuesta(carrito) });
  }

  return {
    obtener: manejar({ cookies: cookiesCarritoSchema }, async ({ cookies, cliente }, res) => {
      const consulta = await servicio.obtener(compradorDe(cookies[COOKIE_CARRITO], cliente));
      if (consulta.cookieObsoleta) res.clearCookie(COOKIE_CARRITO, opcionesCookie);
      enviarCarrito(res, consulta.carrito);
    }),

    agregarLinea: manejar(
      { body: agregarLineaSchema, cookies: cookiesCarritoSchema },
      async ({ body, cookies, cliente }, res) => {
        const comprador = compradorDe(cookies[COOKIE_CARRITO], cliente);
        const { carrito, tokenNuevo } = await servicio.agregarLinea(comprador, body);
        enviarCarrito(res, carrito, tokenNuevo);
      },
    ),

    actualizarCantidad: manejar(
      {
        params: paramsIdLineaSchema,
        body: actualizarCantidadSchema,
        cookies: cookiesCarritoSchema,
      },
      async ({ params, body, cookies, cliente }, res) => {
        const comprador = compradorDe(cookies[COOKIE_CARRITO], cliente);
        enviarCarrito(
          res,
          await servicio.actualizarCantidad(comprador, params.idLinea, body.cantidad),
        );
      },
    ),

    marcarAvisosVistos: manejar(
      { cookies: cookiesCarritoSchema },
      async ({ cookies, cliente }, res) => {
        const comprador = compradorDe(cookies[COOKIE_CARRITO], cliente);
        enviarCarrito(res, await servicio.marcarAvisosVistos(comprador));
      },
    ),

    aplicarCupon: manejar(
      { body: aplicarCuponSchema, cookies: cookiesCarritoSchema },
      async ({ body, cookies, cliente }, res) => {
        const comprador = compradorDe(cookies[COOKIE_CARRITO], cliente);
        enviarCarrito(res, await servicio.aplicarCupon(comprador, body.codigo));
      },
    ),

    quitarCupon: manejar({ cookies: cookiesCarritoSchema }, async ({ cookies, cliente }, res) => {
      const comprador = compradorDe(cookies[COOKIE_CARRITO], cliente);
      enviarCarrito(res, await servicio.quitarCupon(comprador));
    }),

    eliminarLinea: manejar(
      { params: paramsIdLineaSchema, cookies: cookiesCarritoSchema },
      async ({ params, cookies, cliente }, res) => {
        const comprador = compradorDe(cookies[COOKIE_CARRITO], cliente);
        enviarCarrito(res, await servicio.eliminarLinea(comprador, params.idLinea));
      },
    ),
  };
}
