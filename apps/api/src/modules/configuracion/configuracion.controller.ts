import type { RequestHandler } from 'express';
import { montoATexto } from '../../shared/dinero/index.js';
import { manejar } from '../../shared/http/index.js';
import { actualizarConfiguracionSchema } from './configuracion.schemas.js';
import type { ConfiguracionService } from './configuracion.service.js';
import type { Configuracion } from './configuracion.types.js';

const aRespuesta = (configuracion: Configuracion) => ({
  ...configuracion,
  montoEnvioGratis:
    configuracion.montoEnvioGratis === null ? null : montoATexto(configuracion.montoEnvioGratis),
  fechaActualizacion: configuracion.fechaActualizacion.toISOString(),
});

export interface ConfiguracionController {
  obtener: RequestHandler;
  actualizar: RequestHandler;
}

export function crearConfiguracionController(
  servicio: ConfiguracionService,
): ConfiguracionController {
  return {
    obtener: manejar({}, async (_entrada, res) => {
      res.json({ datos: aRespuesta(await servicio.obtener()) });
    }),

    actualizar: manejar({ body: actualizarConfiguracionSchema }, async ({ body }, res) => {
      res.json({ datos: aRespuesta(await servicio.actualizar(body)) });
    }),
  };
}
