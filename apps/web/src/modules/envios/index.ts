// API pública del módulo envios: el checkout (M4-H02) elige el método con su costo y el total con envío, y
// escribe su plazo como lo escribe el backoffice (M9-H02).
export type { MetodoEnvio, MetodosEnvio } from './envios.api';
export { useMetodosEnvio } from './hooks/useMetodosEnvio';
export { diasDeEntrega } from './diasDeEntrega';
