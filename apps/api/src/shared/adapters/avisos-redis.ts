import type { EventEmitter } from 'node:events';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { z } from 'zod';
import type { AvisosDeVersion, OyenteDeAvisos } from '../avisos/index.js';
import { crearRegistroPorCambioDeEstado } from './redis.js';

/** El canal de pub/sub de los avisos del dashboard (E9-H02). */
export const CANAL_AVISOS = 'reportes:avisos';

const avisoSchema = z.object({ dominio: z.string().min(1), version: z.number().int().positive() });

function leerAviso(mensaje: string): z.infer<typeof avisoSchema> | null {
  try {
    const aviso = avisoSchema.safeParse(JSON.parse(mensaje));
    return aviso.success ? aviso.data : null;
  } catch {
    return null;
  }
}

/** Lo que se usa de la conexión de suscripción (un `Redis` de ioredis lo cumple). */
interface Suscriptor extends Pick<EventEmitter, 'on'> {
  connect(): Promise<void>;
  subscribe(canal: string): Promise<unknown>;
  quit(): Promise<unknown>;
}

/**
 * Adaptador de AvisosDeVersion (E9-H02, A-25) sobre Redis pub/sub. Publica con el cliente de siempre; se suscribe
 * con una conexión propia (`duplicate`: la misma contraseña y base), porque una conexión suscrita no puede
 * ejecutar otros comandos. ioredis se vuelve a suscribir solo al reconectar; el oyente lo sabe por `alReconectar`.
 */
export function crearAvisosRedis(
  cliente: Pick<Redis, 'publish'> & { duplicate(): Suscriptor },
  logger: Logger,
): AvisosDeVersion & { cerrar(): Promise<void> } {
  const registro = crearRegistroPorCambioDeEstado(logger, 'avisos del dashboard');
  let suscriptor: Suscriptor | undefined;

  function escuchar(conexion: Suscriptor, oyente: OyenteDeAvisos): void {
    let estado: 'conectando' | 'lista' | 'caida' = 'conectando';
    // ioredis restablece al reconectar solo lo ya suscrito: con Redis caído al arrancar, la primera suscripción
    // ocurre en el primer `ready`, venga o no después de una caída.
    let suscrito = false;
    conexion.on('ready', () => {
      if (!suscrito) {
        suscrito = true;
        conexion.subscribe(CANAL_AVISOS).catch((error: unknown) => {
          suscrito = false;
          logger.warn({ err: error }, 'No se pudo suscribir a los avisos del dashboard');
        });
      }
      if (estado === 'caida') {
        logger.info('La suscripción a los avisos del dashboard volvió');
        oyente.alReconectar();
      }
      estado = 'lista';
    });
    conexion.on('error', (error: Error) => {
      if (estado === 'caida') return;
      estado = 'caida';
      logger.warn(
        { err: error },
        'La suscripción a los avisos del dashboard se cayó: no llegan eventos',
      );
    });
    conexion.on('message', (canal: string, mensaje: string) => {
      if (canal !== CANAL_AVISOS) return;
      const aviso = leerAviso(mensaje);
      if (aviso === null) {
        logger.warn({ canal }, 'Aviso del dashboard con otra forma: se descarta');
        return;
      }
      oyente.alRecibir(aviso);
    });
  }

  return {
    async publicar(aviso) {
      try {
        await cliente.publish(CANAL_AVISOS, JSON.stringify(aviso));
        registro.exito();
      } catch (error) {
        registro.fallo(error);
      }
    },

    suscribir(oyente) {
      suscriptor = cliente.duplicate();
      escuchar(suscriptor, oyente);
      suscriptor.connect().catch(() => {
        // El primer intento fallido ya lo registró el evento 'error'; ioredis sigue reintentando.
      });
    },

    async cerrar() {
      await suscriptor?.quit();
    },
  };
}
