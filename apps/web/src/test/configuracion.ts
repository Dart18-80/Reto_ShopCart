import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { servidor } from './servidor';

// Una petición sin handler es un error de la prueba, no una llamada a la red real.
beforeAll(() => {
  servidor.listen({ onUnhandledFrame: 'error' });
});
afterEach(() => {
  cleanup();
  servidor.resetHandlers();
});
afterAll(() => {
  servidor.close();
});
