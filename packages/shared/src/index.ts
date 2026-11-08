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
export { pagarSchema, type Pagar } from './checkout.js';
export {
  actualizarCategoriaSchema,
  actualizarProductoSchema,
  actualizarVarianteSchema,
  cambiarPrecioSchema,
  consultaProductosAdminSchema,
  crearAtributoSchema,
  crearCategoriaSchema,
  crearProductoSchema,
  crearVarianteSchema,
  guardarImagenesSchema,
  crearValorAtributoSchema,
  ilustracionSchema,
  imagenProductoSchema,
  ordenDespliegueSchema,
  ordenProductosAdminSchema,
  precioVarianteSchema,
  type ActualizarCategoria,
  type ActualizarProducto,
  type ActualizarVariante,
  type ConsultaProductosAdmin,
  type CrearAtributo,
  type CrearCategoria,
  type CrearProducto,
  type CrearValorAtributo,
  type DatosPrecio,
  type DatosVariante,
  type GuardarImagenes,
  type ImagenProducto,
  type OrdenProductosAdmin,
} from './catalogo-admin.js';
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
  rangoDeFechasSchema,
  TAMANO_MAXIMO_PAGINA,
} from './consultas.js';
export {
  actualizarDireccionSchema,
  crearDireccionSchema,
  type ActualizarDireccion,
  type CrearDireccion,
} from './direcciones.js';
export {
  CANTIDAD_MAXIMA_MOVIMIENTO,
  consultaExistenciasSchema,
  ordenExistenciasSchema,
  registrarAjusteSchema,
  registrarEntradaSchema,
  type ConsultaExistencias,
  type OrdenExistencias,
  type RegistrarAjuste,
  type RegistrarEntrada,
} from './inventario.js';
export { montoMenorOIgual, montoSchema } from './monto.js';
export { ordenConsultaSchema, type DireccionOrden } from './orden.js';
export {
  cambiarEstadoPedidoSchema,
  cancelarPedidoSchema,
  consultaPedidosGestionSchema,
  ESTADOS_PEDIDO,
  ordenPedidosGestionSchema,
  registrarDevolucionSchema,
  type CambiarEstadoPedido,
  type CancelarPedido,
  type ConsultaPedidosGestion,
  type EstadoPedido,
  type OrdenPedidosGestion,
  type RegistrarDevolucion,
} from './pedidos.js';
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
