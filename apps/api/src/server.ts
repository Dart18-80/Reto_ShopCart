import type { Logger } from 'pino';
import { registrarApagadoOrdenado } from './apagado.js';
import { crearApp } from './app.js';
import { crearTareasDeCarrito } from './modules/carrito/index.js';
import { crearDifusorDeVersiones, crearInvalidadorReportes } from './modules/reportes/index.js';
import { crearAvisosRedis } from './shared/adapters/avisos-redis.js';
import { crearCacheRedis } from './shared/adapters/cache-redis.js';
import { crearAlmacenEnDisco } from './shared/adapters/almacen-disco.js';
import {
  contarExportacionesPendientes,
  crearProcesadorExportaciones,
  crearTareasDeExportaciones,
} from './modules/exportaciones/index.js';
import { crearTareasDeCheckout } from './modules/checkout/index.js';
import { crearTareasDePedidos } from './modules/pedidos/index.js';
import { crearTareasDeSistema } from './modules/sistema/index.js';
import { crearPasarelaSimulada } from './shared/adapters/pasarela-simulada.js';
import {
  crearClienteRedis,
  crearVerificadorRedis,
  registrarCambiosDeEstado,
} from './shared/adapters/redis.js';
import {
  cargarConfiguracion,
  ErrorConfiguracion,
  type ConfiguracionRedis,
} from './shared/config/index.js';
import { crearLimitadorRedis } from './shared/adapters/limitador-redis.js';
import { crearVersionesSesionRedis } from './shared/adapters/versiones-sesion-redis.js';
import { conectarPool, conexionMssql, configurarBaseDatos } from './shared/db/index.js';
import { crearTokensAcceso } from './shared/http/index.js';
import { crearPlanificador } from './shared/jobs/index.js';
import { conTrazas, crearLogger, metricasDeNegocio } from './shared/observability/index.js';
import { detenerTelemetria } from './shared/observability/telemetria.js';

const ESPERA_APAGADO_MS = 10_000;
// A-07: login 5 por minuto por IP y correo; registro 3 por minuto por IP; cambio de contraseña 5 por
// minuto por usuario.
const LIMITE_LOGIN = { intentos: 5, ventanaSeg: 60 };
const LIMITE_REGISTRO = { intentos: 3, ventanaSeg: 60 };
const LIMITE_CAMBIO_CONTRASENA = { intentos: 5, ventanaSeg: 60 };
const LIMITE_CARRITO_INVITADO = { intentos: 20, ventanaSeg: 60 };
const LIMITE_EXPORTACIONES = { intentos: 10, ventanaSeg: 60 };

type ClienteRedis = ReturnType<typeof crearClienteRedis>;

async function iniciar(): Promise<void> {
  const config = cargarConfiguracion(process.env);
  const logger = crearLogger({ nivel: config.nivelLog, instancia: config.instancia });

  const pool = await conectarPool(config.baseDatos);
  // mssql reemite en el pool los errores de conexión; sin listener, EventEmitter los lanza y tumban la réplica.
  pool.on('error', (error: unknown) => {
    logger.error({ err: error }, 'Error del pool de SQL Server');
  });
  configurarBaseDatos(conexionMssql(pool), logger);
  const redis = conectarRedis(config.redis, logger);
  // E9-H01: cada operación de la pasarela es un span propio.
  const pasarela = conTrazas(crearPasarelaSimulada());
  const cache = crearCacheRedis(redis, logger);
  // E9-H02 (A-25): el canal entre réplicas (con su propia conexión de suscripción) y los streams de esta réplica.
  const avisos = crearAvisosRedis(redis, logger.child({ modulo: 'reportes' }));
  const difusorEventos = crearDifusorDeVersiones({
    cache,
    avisos,
    logger: logger.child({ modulo: 'reportes' }),
  });
  const reportes = crearInvalidadorReportes(cache, avisos);
  const almacen = crearAlmacenEnDisco(config.directorioAlmacen);
  const exportaciones = crearProcesadorExportaciones({ almacen, cache, logger });

  const app = crearApp({
    logger,
    instancia: config.instancia,
    origenesCors: config.origenesCors,
    verificadorRedis: crearVerificadorRedis(redis),
    tokensAcceso: crearTokensAcceso(config.secretoJwt, logger),
    limitadores: {
      login: crearLimitadorRedis(redis, logger, { prefijo: 'limite:login', ...LIMITE_LOGIN }),
      registro: crearLimitadorRedis(redis, logger, {
        prefijo: 'limite:registro',
        ...LIMITE_REGISTRO,
      }),
      cambioContrasena: crearLimitadorRedis(redis, logger, {
        prefijo: 'limite:contrasena',
        ...LIMITE_CAMBIO_CONTRASENA,
      }),
      carritoInvitado: crearLimitadorRedis(redis, logger, {
        prefijo: 'limite:carrito',
        ...LIMITE_CARRITO_INVITADO,
      }),
      exportaciones: crearLimitadorRedis(redis, logger, {
        prefijo: 'limite:exportaciones',
        ...LIMITE_EXPORTACIONES,
      }),
    },
    versionesSesion: crearVersionesSesionRedis(redis, logger),
    pasarela,
    cache,
    almacen,
    exportaciones,
    avisos,
    difusorEventos,
  });

  // Express 5 también llama a este callback si listen falla (por ejemplo, puerto ocupado).
  const servidor = app.listen(config.puerto, (error?: Error) => {
    if (error !== undefined) {
      logger.fatal({ err: error, puerto: config.puerto }, 'La API no pudo escuchar en el puerto');
      process.exit(1);
    }
    logger.info({ puerto: config.puerto, entorno: config.entorno }, 'API escuchando');
  });

  // El callback de listen solo cubre el arranque; un error posterior (por ejemplo, EMFILE) se perdería.
  servidor.on('error', (error) => {
    logger.error({ err: error }, 'Error del servidor HTTP');
  });

  // A-04: solo el servidor arranca las tareas periódicas; las pruebas usan crearApp sin ellas.
  const planificador = crearPlanificador(
    [
      ...crearTareasDeCheckout({ pasarela, logger }),
      ...crearTareasDePedidos({ pasarela, logger, reportes }),
      ...crearTareasDeCarrito(reportes),
      ...crearTareasDeExportaciones({ procesador: exportaciones, almacen, logger }),
      ...crearTareasDeSistema(),
    ],
    logger.child({ modulo: 'jobs' }),
    config.instancia,
  );
  metricasDeNegocio.observarExportacionesPendientes(contarExportacionesPendientes);
  planificador.iniciar();

  registrarApagadoOrdenado({
    proceso: process,
    servidor,
    // Las tareas en curso terminan antes de cerrar el pool que usan.
    recursos: [
      // Primero dejan de correr las tareas y las exportaciones en curso (las que disparó un POST también).
      () =>
        planificador
          .detener()
          .then(() => exportaciones.detener())
          .then(() => pool.close()),
      () => avisos.cerrar().then(() => redis.quit()),
      // E9-H01: lo pendiente de exportar sale antes de terminar. Corre a la vez que los demás cierres: lo que
      // ellos registren después del vaciado se pierde (sin el colector, el apagado no espera por la telemetría).
      detenerTelemetria,
    ],
    logger,
    salir: (codigo) => process.exit(codigo),
    esperaMaximaMs: ESPERA_APAGADO_MS,
    // E9-H02: los streams del dashboard no terminan solos; el cliente reconecta a la otra réplica.
    alIniciar: [
      () => {
        difusorEventos.cerrarTodas();
      },
    ],
  });
}

// RNF-2: si Redis no está al arrancar, la API arranca igual y el cliente reintenta en segundo plano.
function conectarRedis(config: ConfiguracionRedis, logger: Logger): ClienteRedis {
  const redis = crearClienteRedis(config);
  registrarCambiosDeEstado(redis, logger);
  // No se traga: el mismo fallo se emite como evento 'error' y lo registra registrarCambiosDeEstado.
  redis.connect().catch(() => undefined);
  return redis;
}

iniciar().catch((error: unknown) => {
  const logger = crearLogger();
  if (error instanceof ErrorConfiguracion) {
    logger.fatal(error.message);
  } else {
    logger.fatal({ err: error }, 'La API no pudo arrancar');
  }
  process.exit(1);
});
