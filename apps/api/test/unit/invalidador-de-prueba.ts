import { vi } from 'vitest';
import { crearInvalidadorReportes } from '../../src/modules/reportes/index.js';

/** A-11: el invalidador real sobre una caché falsa; `invalidaciones` registra cada incremento de la versión. */
export function invalidadorDePrueba() {
  const invalidaciones = vi.fn((_clave: string) => Promise.resolve());
  const reportes = crearInvalidadorReportes({
    obtener: () => Promise.resolve(null),
    guardar: () => Promise.resolve(),
    contador: () => Promise.resolve(null),
    incrementar: invalidaciones,
  });
  return { reportes, invalidaciones };
}
