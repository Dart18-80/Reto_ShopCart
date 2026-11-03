import { vi } from 'vitest';

export const ANCHO_ESCRITORIO = 1280;
export const ANCHO_TELEFONO = 375;
const PX_POR_REM = 16;

/** El ancho mínimo que pide una consulta `(min-width: 48rem)` o `(min-width: 768px)`, en píxeles. */
function anchoMinimo(consulta: string): number | null {
  const coincidencia = /\(min-width:\s*([\d.]+)(rem|px)\)/.exec(consulta);
  if (!coincidencia) return null;
  const [, valor = '0', unidad] = coincidencia;
  return Number(valor) * (unidad === 'rem' ? PX_POR_REM : 1);
}

/**
 * jsdom no implementa matchMedia ni aplica CSS: esto simula una pantalla de `ancho` píxeles. Las consultas de
 * `min-width` se evalúan contra ese ancho; cualquier otra (el tema del sistema) no coincide, así que es claro.
 */
export function simularPantalla(ancho: number) {
  vi.stubGlobal(
    'matchMedia',
    (
      consulta: string,
    ): Pick<MediaQueryList, 'matches' | 'media' | 'addEventListener' | 'removeEventListener'> => {
      const minimo = anchoMinimo(consulta);
      return {
        matches: minimo !== null && ancho >= minimo,
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      };
    },
  );
}
