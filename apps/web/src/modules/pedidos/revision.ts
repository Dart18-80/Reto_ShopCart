import type { ResolucionPago } from '@shopcart/shared';

// E9-H04: cada resolución dice qué hace; el backend decide si corresponde a este pago (422 RESOLUCION_NO_APLICA).
export const RESOLUCION: Record<ResolucionPago, { nombre: string; detalle: string }> = {
  CobroVerificado: {
    nombre: 'Cobro verificado',
    detalle:
      'Para un intento con pedido: la pasarela confirma la captura y el pedido sigue su flujo.',
  },
  SinCobro: {
    nombre: 'Sin cobro',
    detalle: 'Para un intento con pedido sin captura: cancela el pedido, sin reembolso.',
  },
  Reembolsar: {
    nombre: 'Reembolsar el cobro',
    detalle: 'Para un cobro capturado sin pedido: crea un reembolso que el sistema procesa.',
  },
};
