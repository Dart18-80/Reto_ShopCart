// Esquemas Zod y tipos compartidos entre la API y la web; se llenan módulo por módulo.
export {
  contrasenaSchema,
  correoSchema,
  loginSchema,
  registroSchema,
  type DatosLogin,
  type DatosRegistro,
} from './auth.js';
export {
  actualizarCantidadSchema,
  agregarLineaSchema,
  aplicarCuponSchema,
  type ActualizarCantidad,
  type AgregarLinea,
  type AplicarCupon,
} from './carrito.js';
export {
  consultaBusquedaSchema,
  DIRECCIONES_ORDEN,
  filtroPrecioSchema,
  ILUSTRACIONES_PRENDA,
  LARGO_MAXIMO_TEXTO_BUSQUEDA,
  ORDENES_BUSQUEDA,
  type ConsultaBusqueda,
  type FiltroPrecio,
  type IlustracionPrenda,
} from './catalogo.js';
export {
  booleanoConsultaSchema,
  consultaPaginacionSchema,
  idEnRutaSchema,
  idSchema,
  TAMANO_MAXIMO_PAGINA,
} from './consultas.js';
export { montoMenorOIgual, montoSchema } from './monto.js';
export { ROLES_DE_USUARIO, type RolDeUsuario } from './roles.js';
export { telefonoSchema } from './telefono.js';
export { textoNvarchar } from './texto.js';
export {
  actualizarPerfilSchema,
  alMenosUnCampo,
  cambiarContrasenaSchema,
  type ActualizarPerfil,
  type CambiarContrasena,
} from './usuarios.js';
