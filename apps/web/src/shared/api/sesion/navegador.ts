import { ROLES_DE_USUARIO } from '@shopcart/shared';
import { z } from 'zod';
import type { Bloqueo, Canal, MensajeSesion, Rol } from './sesion';

const NOMBRE_DEL_BLOQUEO = 'shopcart-refresh';
const NOMBRE_DEL_CANAL = 'shopcart-sesion';

// Los roles salen de @shopcart/shared, la misma lista que usa la API; una prueba de tipos la ata al contrato.
const rolSchema = z.enum(ROLES_DE_USUARIO) satisfies z.ZodType<Rol>;

// Lo que otra pestaña puede publicar. Un mensaje que no cumple (otra versión de la app tras un despliegue,
// cualquier otro script del mismo origen) se ignora: nunca cambia la sesión.
const mensajeSesionSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('cerrada') }),
  z.object({
    tipo: z.literal('token'),
    sesion: z.object({
      accessToken: z.string().min(1),
      usuario: z.object({
        idUsuario: z.number().int().positive(),
        correo: z.string(),
        nombre: z.string(),
        rol: rolSchema,
      }),
    }),
  }),
]) satisfies z.ZodType<MensajeSesion>;

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

/** Solo el mismo origen puede publicar en el canal; aun así, cada mensaje se valida antes de usarlo. */
export function crearCanalDelNavegador(): Canal {
  const canal = new BroadcastChannel(NOMBRE_DEL_CANAL);
  return {
    publicar(mensaje) {
      canal.postMessage(mensaje);
    },
    alRecibir(receptor) {
      canal.onmessage = (evento: MessageEvent<unknown>) => {
        const mensaje = mensajeSesionSchema.safeParse(evento.data);
        if (mensaje.success) receptor(mensaje.data);
      };
    },
  };
}
