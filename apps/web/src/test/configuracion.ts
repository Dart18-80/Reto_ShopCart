import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { sesion } from '../shared/api';
import { ANCHO_ESCRITORIO, simularPantalla } from './pantalla';
import { servidor } from './servidor';

// Una petición sin handler es un error de la prueba, no una llamada a la red real.
beforeAll(() => {
  servidor.listen({ onUnhandledFrame: 'error' });
});
beforeEach(() => {
  simularPantalla(ANCHO_ESCRITORIO);
});
afterEach(() => {
  cleanup();
  servidor.resetHandlers();
  sesion.olvidar();
});
afterAll(() => {
  servidor.close();
});
