import { crearClienteApi } from './cliente';

export { crearQueryClient } from './consultas';
export { ErrorApi } from './ErrorApi';
export type { Cuerpo, Respuesta } from './tipos';

/** El único cliente de la API (FE-13). F1-H04 le conecta el token de la sesión. */
export const api = crearClienteApi({ obtenerToken: () => null });
