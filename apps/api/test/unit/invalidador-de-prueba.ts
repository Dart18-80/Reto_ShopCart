import { vi } from 'vitest';
import { crearInvalidadorReportes } from '../../src/modules/reportes/index.js';
import { SIN_AVISOS } from '../../src/shared/avisos/index.js';

/** A-11: el invalidador real sobre una caché falsa; `invalidaciones` registra la clave de cada versión incrementada. */
export function invalidadorDePrueba() {
  const invalidaciones = vi.fn((_clave: string) => Promise.resolve(1));
  const reportes = crearInvalidadorReportes(
    {
      obtener: () => Promise.resolve(null),
      guardar: () => Promise.resolve(),
      contador: () => Promise.resolve(null),
      incrementar: invalidaciones,
    },
    SIN_AVISOS,
  );
  return { reportes, invalidaciones };
}
