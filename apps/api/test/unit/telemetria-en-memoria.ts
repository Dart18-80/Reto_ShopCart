import { context, metrics, propagation, trace } from '@opentelemetry/api';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { afterAll, afterEach, beforeAll } from 'vitest';

const INTERVALO_LARGO_MS = 3_600_000;

/**
 * Trazas y métricas en memoria para la suite: registra los proveedores globales antes de las pruebas y los
 * quita al final. `spans()` y `metricas()` leen lo exportado; cada prueba empieza vacía.
 */
export function usarTelemetriaEnMemoria() {
  const exportadorSpans = new InMemorySpanExporter();
  const exportadorMetricas = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const lector = new PeriodicExportingMetricReader({
    exporter: exportadorMetricas,
    exportIntervalMillis: INTERVALO_LARGO_MS,
  });
  const trazas = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exportadorSpans)],
  });
  const medidor = new MeterProvider({ readers: [lector] });

  beforeAll(() => {
    trazas.register();
    metrics.setGlobalMeterProvider(medidor);
  });

  afterEach(() => {
    exportadorSpans.reset();
  });

  afterAll(async () => {
    trace.disable();
    context.disable();
    propagation.disable();
    metrics.disable();
    await trazas.shutdown();
    await medidor.shutdown();
  });

  return {
    spans: () => exportadorSpans.getFinishedSpans(),
    /** Los puntos de cada métrica de ShopCart al momento de leer. */
    async metricas(): Promise<
      Map<string, { atributos: Record<string, unknown>; valor: number }[]>
    > {
      await lector.forceFlush();
      const resultado = new Map<string, { atributos: Record<string, unknown>; valor: number }[]>();
      for (const lote of exportadorMetricas.getMetrics()) {
        for (const alcance of lote.scopeMetrics) {
          for (const metrica of alcance.metrics) {
            resultado.set(
              metrica.descriptor.name,
              metrica.dataPoints.map((punto) => ({
                atributos: { ...punto.attributes },
                valor: typeof punto.value === 'number' ? punto.value : Number.NaN,
              })),
            );
          }
        }
      }
      exportadorMetricas.reset();
      return resultado;
    },
  };
}
