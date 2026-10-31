import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import swaggerUi from 'swagger-ui-express';
import { crearModuloAuth, crearSesiones, type LimitadoresAuth } from './modules/auth/index.js';
import { crearModuloDirecciones } from './modules/direcciones/index.js';
import { crearModuloSistema, type VerificadorRedis } from './modules/sistema/index.js';
import { crearModuloUsuarios } from './modules/usuarios/index.js';
import { manejadorErrores, rutaNoEncontrada } from './shared/errors/index.js';
import {
  crearAutenticar,
  encabezadoInstancia,
  requestId,
  type ListaRevocados,
  type TokensAcceso,
} from './shared/http/index.js';
import { registrarPeticiones } from './shared/observability/index.js';
import { generarDocumentoOpenApi } from './shared/openapi/index.js';

const LIMITE_CUERPO_JSON = '100kb';
const SALTOS_DE_PROXY_CONFIABLES = 1;

export interface DependenciasApp {
  logger: Logger;
  instancia: string;
  origenesCors: string[];
  verificadorRedis: VerificadorRedis;
  tokensAcceso: TokensAcceso;
  limitadores: LimitadoresAuth;
  listaRevocados: ListaRevocados;
}

/** Composición: middlewares, rutas e inyección de adaptadores (01-arquitectura.md §4.3). */
export function crearApp({
  logger,
  instancia,
  origenesCors,
  verificadorRedis,
  tokensAcceso,
  limitadores,
  listaRevocados,
}: DependenciasApp): Express {
  const app = express();
  app.disable('x-powered-by');
  // nginx está delante: req.ip y el protocolo salen de X-Forwarded-* (necesario para rate limit en E2).
  app.set('trust proxy', SALTOS_DE_PROXY_CONFIABLES);

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
  v1.use('/auth', crearModuloAuth({ tokens: tokensAcceso, limitadores }));

  const autenticar = crearAutenticar({ tokens: tokensAcceso, listaRevocados });
  const sesiones = crearSesiones(tokensAcceso);
  v1.use('/usuarios', crearModuloUsuarios({ autenticar, sesiones, listaRevocados }));
  v1.use(crearModuloDirecciones({ autenticar }));
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
