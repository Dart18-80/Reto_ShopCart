import { pino } from 'pino';
import type { DependenciasApp } from '../src/app.js';
import { crearPasarelaSimulada } from '../src/shared/adapters/pasarela-simulada.js';
import type { Cache } from '../src/shared/cache/index.js';
import {
  crearTokensAcceso,
  type LimitadorIntentos,
  type VersionesSesion,
} from '../src/shared/http/index.js';

export const SECRETO_JWT_DE_PRUEBA = 'secreto-de-prueba-de-al-menos-32-caracteres';

/** Un limitador que nunca rechaza: las pruebas que no prueban el rate limiting no se cruzan con él. */
export const SIN_LIMITE: LimitadorIntentos = {
  consumir: () => Promise.resolve({ permitido: true, segundosParaReintentar: 0 }),
};

/** Versiones de sesión en memoria: se comportan como las de Redis (nunca bajan), sin Redis. */
export function versionesSesionEnMemoria(): VersionesSesion {
  const vigentes = new Map<number, number>();
  return {
    vigente: (idUsuario) => Promise.resolve(vigentes.get(idUsuario) ?? null),
    publicar: (idUsuario, versionSesion) => {
      vigentes.set(idUsuario, Math.max(versionSesion, vigentes.get(idUsuario) ?? 0));
      return Promise.resolve();
    },
  };
}

/**
 * Sin caché de reportes (se comporta como Redis caído): cada prueba lee la base, aunque otra aplicación de
 * prueba haya escrito sin invalidar. Las pruebas de la caché pasan una real (E7-H04).
 */
export const SIN_CACHE: Cache = {
  obtener: () => Promise.resolve(null),
  guardar: () => Promise.resolve(),
  contador: () => Promise.resolve(null),
  incrementar: () => Promise.resolve(),
};

/** Dependencias de crearApp para pruebas; cada prueba reemplaza solo lo que le importa. */
export function dependenciasDePrueba(cambios: Partial<DependenciasApp> = {}): DependenciasApp {
  return {
    logger: pino({ level: 'silent' }),
    instancia: 'api-prueba',
    origenesCors: ['http://localhost:5173'],
    verificadorRedis: { ping: () => Promise.resolve(true) },
    tokensAcceso: crearTokensAcceso(SECRETO_JWT_DE_PRUEBA, pino({ level: 'silent' })),
    limitadores: {
      login: SIN_LIMITE,
      registro: SIN_LIMITE,
      cambioContrasena: SIN_LIMITE,
      carritoInvitado: SIN_LIMITE,
    },
    versionesSesion: versionesSesionEnMemoria(),
    pasarela: crearPasarelaSimulada(),
    cache: SIN_CACHE,
    ...cambios,
  };
}
