import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { sesion } from '../shared/api';
import { ANCHO_ESCRITORIO, simularPantalla } from './pantalla';
import { servidor } from './servidor';

// Las páginas se cargan con lazy(): la primera vez, Vite transforma su módulo. Con `pnpm test` corriendo todos los
// paquetes a la vez eso pasa de 1 s (el valor por defecto de findBy/waitFor); el plazo cubre la carga, no la lógica.
const PLAZO_DE_ESPERA_MS = 5000;
configure({ asyncUtilTimeout: PLAZO_DE_ESPERA_MS });

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
