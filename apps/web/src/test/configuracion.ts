import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { sesion } from '../shared/api';
import { servidor } from './servidor';

// jsdom no implementa matchMedia: el sistema simulado prefiere el tema claro. Solo lo que usa ProveedorTema.
vi.stubGlobal(
  'matchMedia',
  (
    consulta: string,
  ): Pick<MediaQueryList, 'matches' | 'media' | 'addEventListener' | 'removeEventListener'> => ({
    matches: false,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }),
);

// Una petición sin handler es un error de la prueba, no una llamada a la red real.
beforeAll(() => {
  servidor.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  cleanup();
  servidor.resetHandlers();
  sesion.olvidar();
});
afterAll(() => {
  servidor.close();
});
