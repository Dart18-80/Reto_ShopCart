import { setupServer } from 'msw/node';

/** API simulada de las pruebas de componentes (FE-12). Cada módulo agrega sus handlers en test/handlers/<modulo>.ts. */
export const servidor = setupServer();
