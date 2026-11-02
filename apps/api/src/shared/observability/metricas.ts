import { metrics } from '@opentelemetry/api';

const MEDIDOR = 'shopcart';

// La API de métricas no delega como la de trazas: un instrumento creado antes de registrar el proveedor
// quedaría sin efecto. Se piden al usarlos (el SDK devuelve el mismo instrumento por nombre).
const medidor = () => metrics.getMeter(MEDIDOR);

export type ResultadoTareaMetrica = 'ConTrabajo' | 'SinTrabajo' | 'Omitida' | 'Fallida';

/** E9-H01: métricas de negocio. Sin SDK, no hacen nada. */
export const metricasDeNegocio = {
  pedidoCreado(): void {
    medidor()
      .createCounter('shopcart.pedidos.creados', {
        description: 'Pedidos creados al confirmar un pago',
      })
      .add(1);
  },

  /** `PedidoCreado`, `Repetido` (la misma llave) o el código del error. */
  pagoResuelto(resultado: string): void {
    medidor()
      .createCounter('shopcart.pagos', { description: 'Resultado de cada solicitud de pago' })
      .add(1, { resultado });
  },

  tareaEjecutada(tarea: string, resultado: ResultadoTareaMetrica): void {
    medidor()
      .createCounter('shopcart.tareas.ejecuciones', {
        description: 'Ejecuciones de las tareas periódicas por resultado',
      })
      .add(1, { tarea, resultado });
  },

  /** Se lee al exportar las métricas (cada intervalo del lector), no en cada petición. */
  observarExportacionesPendientes(contar: () => Promise<number>): void {
    medidor()
      .createObservableGauge('shopcart.exportaciones.pendientes', {
        description: 'Solicitudes de exportación pendientes o en proceso',
      })
      .addCallback(async (resultado) => {
        // Con la base caída se omite el punto: la caída ya la registran el pool y el health, y aquí se
        // repetiría en cada intervalo.
        const pendientes = await contar().catch(() => null);
        if (pendientes !== null) resultado.observe(pendientes);
      });
  },
};
