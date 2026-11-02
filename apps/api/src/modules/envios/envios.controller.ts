import type { RequestHandler } from 'express';
import { montoATexto } from '../../shared/dinero/index.js';
import { manejar } from '../../shared/http/index.js';
import { COOKIE_CARRITO, cookiesCarritoSchema } from '../carrito/index.js';
import { actualizarMetodoSchema, paramsIdMetodoSchema } from './envios.schemas.js';
import type { EnviosService } from './envios.service.js';
import type { EnvioGratis, MetodoEnvio, MetodosParaCarrito } from './envios.types.js';

const envioGratisARespuesta = (envio: EnvioGratis | null) =>
  envio === null
    ? null
    : {
        montoMinimo: montoATexto(envio.montoMinimo),
        faltante: montoATexto(envio.faltante),
        alcanzado: envio.alcanzado,
      };

const metodosARespuesta = ({ metodos, envioGratis }: MetodosParaCarrito) => ({
  metodos: metodos.map((metodo) => ({
    ...metodo,
    tarifa: montoATexto(metodo.tarifa),
    costo: montoATexto(metodo.costo),
  })),
  envioGratis: envioGratisARespuesta(envioGratis),
});

const metodoARespuesta = (metodo: MetodoEnvio) => ({ ...metodo, costo: montoATexto(metodo.costo) });

export interface EnviosController {
  listarParaCarrito: RequestHandler;
  actualizarMetodo: RequestHandler;
}

export function crearEnviosController(servicio: EnviosService): EnviosController {
  return {
    listarParaCarrito: manejar({ cookies: cookiesCarritoSchema }, async ({ cookies }, res) => {
      res.json({
        datos: metodosARespuesta(await servicio.listarParaCarrito(cookies[COOKIE_CARRITO])),
      });
    }),

    actualizarMetodo: manejar(
      { params: paramsIdMetodoSchema, body: actualizarMetodoSchema },
      async ({ params, body }, res) => {
        res.json({ datos: metodoARespuesta(await servicio.actualizarMetodo(params.id, body)) });
      },
    ),
  };
}
