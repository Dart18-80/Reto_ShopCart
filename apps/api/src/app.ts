import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import type { Logger } from 'pino';
import swaggerUi from 'swagger-ui-express';
import { crearModuloAuth, crearSesiones, type LimitadoresAuth } from './modules/auth/index.js';
import { crearModuloCarrito } from './modules/carrito/index.js';
import { crearModuloCatalogo } from './modules/catalogo/index.js';
import { crearModuloCheckout } from './modules/checkout/index.js';
import { crearModuloPedidos } from './modules/pedidos/index.js';
import { crearInvalidadorReportes, crearModuloReportes } from './modules/reportes/index.js';
import { crearModuloBitacora } from './modules/bitacora/index.js';
import { crearModuloConfiguracion } from './modules/configuracion/index.js';
import { crearModuloCupones } from './modules/cupones/index.js';
import { crearModuloEnvios } from './modules/envios/index.js';
import { crearModuloDirecciones } from './modules/direcciones/index.js';
import { crearModuloInventario } from './modules/inventario/index.js';
import { crearModuloSistema, type VerificadorRedis } from './modules/sistema/index.js';
import { crearModuloUsuarios } from './modules/usuarios/index.js';
import { manejadorErrores, rutaNoEncontrada } from './shared/errors/index.js';
import {
  crearAutenticar,
  encabezadoInstancia,
  requestId,
  type LimitadorIntentos,
  type TokensAcceso,
  type VersionesSesion,
} from './shared/http/index.js';
import { registrarPeticiones } from './shared/observability/index.js';
import type { PasarelaPago } from './shared/pasarela/index.js';
import { relojDelSistema, type Reloj } from './shared/reloj/index.js';
import type { Cache } from './shared/cache/index.js';
import type { AlmacenArchivos } from './shared/almacen/index.js';
import {
  crearModuloExportaciones,
  type ProcesadorExportaciones,
} from './modules/exportaciones/index.js';
import { generarDocumentoOpenApi } from './shared/openapi/index.js';

const LIMITE_CUERPO_JSON = '100kb';
const SALTOS_DE_PROXY_CONFIABLES = 1;

export interface Limitadores extends LimitadoresAuth {
  /** A-07: 5 intentos por minuto por usuario. */
  cambioContrasena: LimitadorIntentos;
  /** 01 §5.3: 20 carritos de invitado nuevos por minuto por IP. */
  carritoInvitado: LimitadorIntentos;
  /** A-24: solicitudes de exportación por Administrador. */
  exportaciones: LimitadorIntentos;
}

export interface DependenciasApp {
  logger: Logger;
  instancia: string;
  origenesCors: string[];
  verificadorRedis: VerificadorRedis;
  tokensAcceso: TokensAcceso;
  limitadores: Limitadores;
  versionesSesion: VersionesSesion;
  /** N-03: el adaptador de la pasarela (la simulada, con estado en SQL Server). */
  pasarela: PasarelaPago;
  /** A-11: la caché de reportes (Redis); nunca lanza. */
  cache: Cache;
  /** A-24: el almacén de los archivos exportados (compartido por las réplicas). */
  almacen: AlmacenArchivos;
  /** A-24: el consumidor de la cola de exportaciones de esta réplica (el mismo que usan las tareas). */
  exportaciones: ProcesadorExportaciones;
  /** La hora actual (las pruebas la fijan). */
  reloj?: Reloj;
}

/** Composición: middlewares, rutas e inyección de adaptadores (01-arquitectura.md §4.3). */
export function crearApp({
  logger,
  instancia,
  origenesCors,
  verificadorRedis,
  tokensAcceso,
  limitadores,
  versionesSesion,
  pasarela,
  cache,
  almacen,
  exportaciones,
  reloj = relojDelSistema,
}: DependenciasApp): Express {
  const reportes = crearInvalidadorReportes(cache);
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
  v1.use('/auth', crearModuloAuth({ tokens: tokensAcceso, limitadores, logger, reportes }));

  const autenticar = crearAutenticar({ tokens: tokensAcceso, versiones: versionesSesion });
  const sesiones = crearSesiones(tokensAcceso, logger, reportes);
  v1.use(
    '/usuarios',
    crearModuloUsuarios({
      autenticar,
      sesiones,
      versiones: versionesSesion,
      limitadorContrasena: limitadores.cambioContrasena,
      reportes,
    }),
  );
  v1.use(crearModuloDirecciones({ autenticar }));
  v1.use(crearModuloCatalogo({ autenticar, reportes }));
  v1.use('/inventario', crearModuloInventario({ autenticar }));
  v1.use(crearModuloCupones({ autenticar }));
  v1.use(crearModuloEnvios({ autenticar }));
  v1.use(crearModuloConfiguracion({ autenticar, reportes }));
  v1.use(crearModuloCheckout({ autenticar, pasarela, logger, reloj, reportes }));
  v1.use(crearModuloPedidos({ autenticar, pasarela, logger, reportes }));
  v1.use(crearModuloReportes({ autenticar, cache, logger }));
  v1.use(crearModuloBitacora({ autenticar }));
  v1.use(
    crearModuloExportaciones({
      autenticar,
      almacen,
      procesador: exportaciones,
      limitador: limitadores.exportaciones,
      logger,
      reloj,
    }),
  );
  v1.use(
    crearModuloCarrito({
      autenticar,
      limitadorCreacion: limitadores.carritoInvitado,
      reportes,
    }),
  );
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
