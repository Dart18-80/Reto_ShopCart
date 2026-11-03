import type { Bloqueo, Canal, MensajeSesion } from './sesion';

const NOMBRE_DEL_BLOQUEO = 'shopcart-refresh';
const NOMBRE_DEL_CANAL = 'shopcart-sesion';

/** Serializa las tareas solo dentro de esta pestaña: una empieza cuando termina la anterior, aunque falle. */
export function crearBloqueoDeLaPestana(): Bloqueo {
  let ultima: Promise<unknown> = Promise.resolve();
  return {
    exclusivo(tarea) {
      const resultado = ultima.then(tarea);
      ultima = resultado.catch(() => undefined);
      return resultado;
    },
  };
}

/**
 * Web Locks entre pestañas. `navigator.locks` solo existe en contexto seguro (HTTPS o localhost): en
 * `http://<IP>:8080` queda el respaldo por pestaña, con el residual aceptado en 05 §5.
 */
export function crearBloqueoDelNavegador(): Bloqueo {
  if (!('locks' in navigator)) return crearBloqueoDeLaPestana();
  const { locks } = navigator;
  return { exclusivo: (tarea) => locks.request(NOMBRE_DEL_BLOQUEO, tarea) };
}

/** Solo el mismo origen puede publicar en el canal, es decir, esta misma aplicación en otra pestaña. */
export function crearCanalDelNavegador(): Canal {
  const canal = new BroadcastChannel(NOMBRE_DEL_CANAL);
  return {
    publicar(mensaje) {
      canal.postMessage(mensaje);
    },
    alRecibir(receptor) {
      canal.onmessage = (evento: MessageEvent<MensajeSesion>) => {
        receptor(evento.data);
      };
    },
  };
}
