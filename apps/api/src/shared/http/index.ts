export {
  ejecutarConContexto,
  establecerUsuario,
  obtenerContexto,
  type ContextoPeticion,
  type Rol,
} from './contexto.js';
export { encabezadoInstancia } from './instancia.js';
export {
  consultaPaginacionSchema,
  paginar,
  TAMANO_MAXIMO_PAGINA,
  type ConsultaPaginacion,
  type RespuestaPaginada,
} from './paginacion.js';
export { requestId } from './request-id.js';
export { manejar, type Entrada } from './manejar.js';
