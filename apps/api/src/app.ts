import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import swaggerUi from 'swagger-ui-express';
import { crearModuloSistema, type VerificadorRedis } from './modules/sistema/index.js';
import { manejadorErrores, rutaNoEncontrada } from './shared/errors/index.js';
import { encabezadoInstancia, requestId } from './shared/http/index.js';
import { registrarPeticiones } from './shared/observability/index.js';
import { generarDocumentoOpenApi } from './shared/openapi/index.js';

const LIMITE_CUERPO_JSON = '100kb';

export interface DependenciasApp {
  logger: Logger;
  instancia: string;
  origenesCors: string[];
  verificadorRedis: VerificadorRedis;
}

/** Composición: middlewares, rutas e inyección de adaptadores (01-arquitectura.md §4.3). */
export function crearApp({
  logger,
  instancia,
  origenesCors,
  verificadorRedis,
}: DependenciasApp): Express {
  const app = express();
  app.disable('x-powered-by');
  // nginx está delante: req.ip y el protocolo salen de X-Forwarded-* (necesario para rate limit en E2).
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(encabezadoInstancia(instancia));
  app.use(registrarPeticiones(logger));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // §10: la API nunca se muestra dentro de un iframe.
          'frame-ancestors': ["'none'"],
          // El entorno local es HTTP: forzar https rompería los recursos de /api/docs.
          'upgrade-insecure-requests': null,
        },
      },
    }),
  );
  app.use(cors({ origin: origenesCors, credentials: true }));
  app.use(express.json({ limit: LIMITE_CUERPO_JSON }));

  const v1 = express.Router();
  v1.use(crearModuloSistema({ redis: verificadorRedis, instancia, logger }));
  app.use('/api/v1', v1);

  // Después de montar todas las rutas, para que el documento las incluya.
  const documento = generarDocumentoOpenApi();
  app.get('/api/docs/openapi.json', (_req, res) => {
    res.json(documento);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(documento));

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores(logger));
  return app;
}
