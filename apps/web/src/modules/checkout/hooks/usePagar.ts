import type { Pagar } from '@shopcart/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ErrorApi, refrescar } from '../../../shared/api';
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
  const mutacion = useMutation({
    // La tarjeta se lee del intento y no viaja como `variables`: así nunca queda en el estado de la mutación.
    mutationFn: () => {
      const actual = intento.actual();
      if (!actual) throw ErrorApi.inesperado();
      return pagar(actual.tarjeta, actual.llave);
    },
    gcTime: 0,
    onSuccess: (pedido) => {
      intento.terminar();
      // El carrito se convirtió en el pedido y la sesión ya no está Activa: se vuelven a pedir cuando hagan
      // falta, sin recargar ahora la sesión de la pantalla que se está dejando.
      void refrescar(queryClient, { queryKey: checkoutKeys.sesion(), refetchType: 'none' });
      void refrescar(queryClient, { queryKey: carritoKeys.todo });
      alPagar(pedido);
    },
    onError: (error) => {
      const desenlace = desenlaceDelPago(error);
      if (desenlace.tipo !== 'reintentar') intento.terminar();
      if (!esSesionPerdida(desenlace)) return;
      void refrescar(queryClient, { queryKey: checkoutKeys.sesion(), refetchType: 'none' });
      alPerderSesion(desenlace, error.mensaje);
    },
    onSettled: alResponder,
  });

  return {
    error: mutacion.error,
    isPending: mutacion.isPending,
    /** Para el formulario (useFormularioApi): empieza el intento con la tarjeta, si no hay uno, y la envía. */
    mutateAsync: (tarjeta: Pagar) => {
      intento.preparar(tarjeta);
      return mutacion.mutateAsync();
    },
    /** «Reintentar»: reenvía el intento en curso tal cual, con su misma llave. */
    reintentar: () => {
      if (!mutacion.isPending) mutacion.mutate();
    },
  };
}
