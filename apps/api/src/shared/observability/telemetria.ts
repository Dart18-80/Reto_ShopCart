import { metrics } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ExpressInstrumentation, ExpressLayerType } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { TediousInstrumentation } from '@opentelemetry/instrumentation-tedious';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
  type LogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  type MetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  type Span,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import type { Logger } from 'pino';
import { obtenerContexto } from '../http/contexto.js';
import { ENCABEZADO_REQUEST_ID } from '../http/request-id.js';
import { conRegistroDeEstado } from './exportador-con-estado.js';
import { ATRIBUTOS } from './trazas.js';

const SERVICIO = 'shopcart-api';

/**
 * Lo que el hook de ESM envuelve (`import-in-the-middle`): los paquetes instrumentados que el código ESM importa
 * directamente, por nombre o por su ruta dentro de node_modules (así los resuelve, por ejemplo, Vitest). Lo que
 * ellos cargan con require lo ve require-in-the-middle.
 */
export const MODULOS_INSTRUMENTADOS: (string | RegExp)[] = [
  'express',
  'ioredis',
  'pino',
  'mssql',
  'node:http',
  'http',
  /[\\/]node_modules[\\/](?:express|ioredis|pino|mssql)[\\/]/,
];
const RUTA_HEALTH = '/api/v1/health';
// Cada cuánto se exportan las métricas: lo bastante seguido para ver la demo moverse en el dashboard.
const INTERVALO_METRICAS_MS = 15_000;
/**
 * Lo máximo que el apagado espera para vaciar lo pendiente. Sin el colector, el envío esperaría el timeout del
 * exportador y el apagado ordenado (10 s) terminaría forzado: el vaciado es de mejor esfuerzo.
 */
export const ESPERA_VACIADO_TELEMETRIA_MS = 2_000;

export interface SenalesTelemetria {
  procesadoresDeSpans: SpanProcessor[];
  lectoresDeMetricas: MetricReader[];
  procesadoresDeLogs: LogRecordProcessor[];
}

/** Sin colector (la API en el host, las pruebas): los `trace_id` siguen en los logs, nada se exporta. */
export const SIN_EXPORTAR: SenalesTelemetria = {
  procesadoresDeSpans: [],
  lectoresDeMetricas: [],
  procesadoresDeLogs: [],
};

/** RNF-4, A-18: el requestId de la petición en curso en cada span que nace dentro de ella. */
const procesadorRequestId: SpanProcessor = {
  onStart(span: Span) {
    const requestId = obtenerContexto()?.requestId;
    if (requestId !== undefined) span.setAttribute(ATRIBUTOS.requestId, requestId);
  },
  onEnd: () => undefined,
  forceFlush: () => Promise.resolve(),
  shutdown: () => Promise.resolve(),
};

let apagar: (() => Promise<unknown>) | undefined;

/**
 * E9-H01: trazas, métricas y logs, y las instrumentaciones automáticas. Va antes que todo (`node --import`):
 * una librería importada antes no queda instrumentada.
 *
 * Seguridad: las trazas no llevan valores de SQL (tedious solo pone el SP), argumentos de Redis (solo el
 * comando), encabezados (la instrumentación HTTP no los captura si no se le piden) ni cuerpos.
 */
export function iniciarTelemetria(instancia: string, senales: SenalesTelemetria): void {
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICIO,
    'service.instance.id': instancia,
  });
  const trazas = new NodeTracerProvider({
    resource,
    spanProcessors: [procesadorRequestId, ...senales.procesadoresDeSpans],
  });
  trazas.register();
  const medidor = new MeterProvider({ resource, readers: senales.lectoresDeMetricas });
  metrics.setGlobalMeterProvider(medidor);
  const registros = new LoggerProvider({ resource, processors: senales.procesadoresDeLogs });
  logs.setGlobalLoggerProvider(registros);

  registerInstrumentations({
    tracerProvider: trazas,
    meterProvider: medidor,
    loggerProvider: registros,
    instrumentations: [
      new HttpInstrumentation({
        // El healthcheck de Docker y de nginx llega cada pocos segundos: sería ruido.
        ignoreIncomingRequestHook: (peticion) => peticion.url?.startsWith(RUTA_HEALTH) ?? false,
        // El span HTTP empieza antes del middleware que asigna el requestId: se toma de la respuesta.
        applyCustomAttributesOnSpan: (span, _peticion, respuesta) => {
          if (!('getHeader' in respuesta)) return;
          const requestId = respuesta.getHeader(ENCABEZADO_REQUEST_ID);
          if (typeof requestId === 'string') span.setAttribute(ATRIBUTOS.requestId, requestId);
        },
      }),
      // Solo el handler de cada ruta (que fija http.route): los middlewares y routers serían ruido en la traza.
      new ExpressInstrumentation({
        ignoreLayersType: [ExpressLayerType.MIDDLEWARE, ExpressLayerType.ROUTER],
      }),
      new TediousInstrumentation(),
      // Solo el nombre del comando: nunca sus argumentos (claves, valores ni la contraseña de AUTH).
      new IORedisInstrumentation({ dbStatementSerializer: (comando) => comando }),
      new PinoInstrumentation(),
    ],
  });

  apagar = () => Promise.allSettled([trazas.shutdown(), medidor.shutdown(), registros.shutdown()]);
}

/** Termina cuando termina `promesa` o cuando pasa `limiteMs`, lo que ocurra primero. */
export function esperarComoMucho(promesa: Promise<unknown>, limiteMs: number): Promise<void> {
  return new Promise((resolver) => {
    const limite = setTimeout(resolver, limiteMs);
    limite.unref();
    const terminar = () => {
      clearTimeout(limite);
      resolver();
    };
    // Rechazada o no, solo importa que terminó: nunca deja un rechazo sin manejar.
    promesa.then(terminar, terminar);
  });
}

/**
 * Vacía lo pendiente y cierra los exportadores (apagado ordenado), como mucho ESPERA_VACIADO_TELEMETRIA_MS. Sin
 * telemetría iniciada, no hace nada.
 */
export async function detenerTelemetria(): Promise<void> {
  if (apagar === undefined) return;
  await esperarComoMucho(apagar(), ESPERA_VACIADO_TELEMETRIA_MS);
}

/** Las tres señales por OTLP/HTTP hacia el colector (`otel-lgtm`), cada una con su registro de estado. */
export function senalesOtlp(
  endpoint: string,
  logger: Pick<Logger, 'warn' | 'info'>,
): SenalesTelemetria {
  const url = (senal: string) => `${endpoint.replace(/\/$/, '')}/v1/${senal}`;
  return {
    procesadoresDeSpans: [
      new BatchSpanProcessor(
        conRegistroDeEstado(new OTLPTraceExporter({ url: url('traces') }), 'trazas', logger),
      ),
    ],
    lectoresDeMetricas: [
      new PeriodicExportingMetricReader({
        exporter: conRegistroDeEstado(
          new OTLPMetricExporter({ url: url('metrics') }),
          'metricas',
          logger,
        ),
        exportIntervalMillis: INTERVALO_METRICAS_MS,
      }),
    ],
    procesadoresDeLogs: [
      new BatchLogRecordProcessor({
        exporter: conRegistroDeEstado(new OTLPLogExporter({ url: url('logs') }), 'logs', logger),
      }),
    ],
  };
}
