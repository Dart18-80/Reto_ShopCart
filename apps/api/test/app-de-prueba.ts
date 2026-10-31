import { pino } from 'pino';
import type { DependenciasApp } from '../src/app.js';
import { crearTokensAcceso, type LimitadorIntentos } from '../src/shared/http/index.js';

export const SECRETO_JWT_DE_PRUEBA = 'secreto-de-prueba-de-al-menos-32-caracteres';

/** Un limitador que nunca rechaza: las pruebas que no prueban el rate limiting no se cruzan con él. */
export const SIN_LIMITE: LimitadorIntentos = {
  consumir: () => Promise.resolve({ permitido: true, segundosParaReintentar: 0 }),
};

/** Dependencias de crearApp para pruebas; cada prueba reemplaza solo lo que le importa. */
export function dependenciasDePrueba(cambios: Partial<DependenciasApp> = {}): DependenciasApp {
  return {
    logger: pino({ level: 'silent' }),
    instancia: 'api-prueba',
    origenesCors: ['http://localhost:5173'],
    verificadorRedis: { ping: () => Promise.resolve(true) },
    tokensAcceso: crearTokensAcceso(SECRETO_JWT_DE_PRUEBA),
    limitadores: { login: SIN_LIMITE, registro: SIN_LIMITE },
    ...cambios,
  };
}
