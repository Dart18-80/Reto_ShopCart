import {
  context,
  ROOT_CONTEXT,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
} from '@opentelemetry/api';

const TRAZADOR = 'shopcart';

/** Atributos propios de ShopCart en los spans (E9-H01). */
export const ATRIBUTOS = {
  requestId: 'shopcart.request_id',
  replica: 'shopcart.replica',
  bloqueoTomado: 'shopcart.tarea.bloqueo_tomado',
  resultadoPasarela: 'shopcart.pasarela.resultado',
  idExportacion: 'shopcart.exportacion.id',
  reporteExportacion: 'shopcart.exportacion.reporte',
  formatoExportacion: 'shopcart.exportacion.formato',
  resultadoExportacion: 'shopcart.exportacion.resultado',
  dominioSse: 'shopcart.sse.dominio',
  versionSse: 'shopcart.sse.version',
  clientesSse: 'shopcart.sse.clientes',
} as const;

/**
 * Ejecuta `funcion` dentro de un span propio: hijo del span activo (la petición o la tarea) y en error si
 * `funcion` lanza. Sin SDK (pruebas, API en el host sin colector) la API de OpenTelemetry no hace nada.
 */
export function enSpan<T>(
  nombre: string,
  atributos: Attributes,
  funcion: (span: Span) => Promise<T>,
): Promise<T> {
  return trace
    .getTracer(TRAZADOR)
    .startActiveSpan(nombre, { attributes: atributos }, async (span) => {
      try {
        return await funcion(span);
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.name : 'Error',
        });
        throw error;
      } finally {
        span.end();
      }
    });
}

/**
 * Ejecuta `funcion` sin span activo: un temporizador creado dentro de una petición no cuelga de su traza lo que
 * hace horas después (el latido del SSE, E9-H02).
 */
export function fueraDeLaTraza<T>(funcion: () => T): T {
  return context.with(ROOT_CONTEXT, funcion);
}
