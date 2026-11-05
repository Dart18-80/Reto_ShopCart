// API pública del módulo envios: el checkout (M4-H02) elige el método con su costo y el total con envío.
export type { MetodoEnvio, MetodosEnvio } from './envios.api';
export { useMetodosEnvio } from './hooks/useMetodosEnvio';
