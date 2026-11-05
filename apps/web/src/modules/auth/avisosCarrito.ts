import type { SesionAbierta } from './auth.api';

type AvisoCarrito = NonNullable<SesionAbierta['avisosCarrito']>[number];

/** N-05: el texto de cada aviso de la fusión del carrito de invitado, tal como llegó en el login o el registro. */
export function textoDelAviso(aviso: AvisoCarrito): string {
  switch (aviso.tipo) {
    case 'CantidadAjustada':
      return `${aviso.producto}: pasaron ${String(aviso.cantidadFinal)} de ${String(aviso.cantidadSolicitada)} a tu carrito, por la existencia disponible.`;
    case 'NoFusionada':
      return `${aviso.producto} no pasó a tu carrito: llegó al máximo de productos.`;
    case 'FusionPendiente':
      return aviso.mensaje;
  }
}
