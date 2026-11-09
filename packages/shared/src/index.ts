// Esquemas Zod y tipos compartidos entre la API y la web; se llenan módulo por módulo.
export {
  consultaBitacoraSchema,
  MODULOS_BITACORA,
  type ConsultaBitacora,
  type ModuloBitacora,
} from './bitacora.js';
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
export { enteroEntre } from './numeros.js';
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
  type RangoDeFechas,
} from './consultas.js';
export {
  actualizarConfiguracionSchema,
  RANGOS_CONFIGURACION,
  type ActualizarConfiguracion,
} from './configuracion.js';
export {
  actualizarCuponSchema,
  consultaCuponesSchema,
  crearCuponSchema,
  MONTO_MINIMO_POR_OMISION,
  ordenCuponesSchema,
  TIPOS_CUPON,
  type ActualizarCupon,
  type ConsultaCupones,
  type CrearCupon,
  type OrdenCupones,
  type TipoCupon,
} from './cupones.js';
export {
  actualizarDireccionSchema,
  crearDireccionSchema,
  type ActualizarDireccion,
  type CrearDireccion,
} from './direcciones.js';
export { actualizarMetodoEnvioSchema, type ActualizarMetodoEnvio } from './envios.js';
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
  consultaReembolsosSchema,
  ESTADOS_PEDIDO,
  ESTADOS_REEMBOLSO,
  ordenPedidosGestionSchema,
  registrarDevolucionSchema,
  RESOLUCIONES_PAGO,
  resolverPagoSchema,
  resolverReembolsoSchema,
  type CambiarEstadoPedido,
  type CancelarPedido,
  type ConsultaPedidosGestion,
  type ConsultaReembolsos,
  type EstadoPedido,
  type EstadoReembolso,
  type OrdenPedidosGestion,
  type RegistrarDevolucion,
  type ResolucionPago,
  type ResolverPago,
  type ResolverReembolso,
} from './pedidos.js';
export {
  AGRUPACIONES,
  consultaCarritosSchema,
  consultaVentasSchema,
  ordenCarritosSchema,
  type Agrupacion,
  type ConsultaCarritos,
  type ConsultaVentas,
  type OrdenCarritos,
} from './reportes.js';
export { ROLES_DE_USUARIO, type RolDeUsuario } from './roles.js';
export { telefonoSchema } from './telefono.js';
export { textoNvarchar } from './texto.js';
export {
  actualizarPerfilSchema,
  actualizarUsuarioSchema,
  alMenosUnCampo,
  cambiarContrasenaSchema,
  consultaUsuariosSchema,
  crearUsuarioInternoSchema,
  ordenUsuariosSchema,
  ROLES_INTERNOS,
  type ActualizarPerfil,
  type ActualizarUsuario,
  type CambiarContrasena,
  type ConsultaUsuarios,
  type CrearUsuarioInterno,
  type OrdenUsuarios,
} from './usuarios.js';
