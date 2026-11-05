import type { Pagar } from '@shopcart/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { carritoKeys } from '../../carrito';
import { pagar, type Pedido } from '../checkout.api';
import { checkoutKeys } from '../checkout.keys';
import { desenlaceDelPago, type Desenlace } from '../politicaDePago';
import type { IntentoDePago } from './useIntentoDePago';

type SesionPerdida = Extract<Desenlace, { tipo: 'volverAlCheckout' | 'volverAlCarrito' }>;

interface OpcionesPagar {
  intento: IntentoDePago;
  /** Después de cada respuesta, buena o mala: la página borra el número y el CVV del formulario. */
  alResponder: () => void;
  alPagar: (pedido: Pedido) => void;
  /** La sesión venció o se agotaron los intentos: la página avisa y sale. */
  alPerderSesion: (desenlace: SesionPerdida, mensaje: string) => void;
}

const esSesionPerdida = (desenlace: Desenlace): desenlace is SesionPerdida =>
  desenlace.tipo === 'volverAlCheckout' || desenlace.tipo === 'volverAlCarrito';

/**
 * RF-06 (01 §6.2): paga la sesión con la llave del intento. Solo «reintentar» conserva el intento (y su llave);
 * cualquier otra respuesta lo termina. Sin optimismo: el pedido es el que devuelve el backend.
 */
export function usePagar({ intento, alResponder, alPagar, alPerderSesion }: OpcionesPagar) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tarjeta: Pagar) => pagar(tarjeta, intento.llavePara(tarjeta)),
    onSuccess: (pedido) => {
      intento.terminar();
      // El carrito se convirtió en el pedido y la sesión ya no está Activa: se vuelven a pedir cuando hagan
      // falta, sin recargar ahora la sesión de la pantalla que se está dejando.
      void queryClient.invalidateQueries({ queryKey: checkoutKeys.sesion(), refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: carritoKeys.todo });
      alPagar(pedido);
    },
    onError: (error) => {
      const desenlace = desenlaceDelPago(error);
      if (desenlace.tipo !== 'reintentar') intento.terminar();
      if (!esSesionPerdida(desenlace)) return;
      void queryClient.invalidateQueries({ queryKey: checkoutKeys.sesion(), refetchType: 'none' });
      alPerderSesion(desenlace, error.mensaje);
    },
    onSettled: alResponder,
  });
}
