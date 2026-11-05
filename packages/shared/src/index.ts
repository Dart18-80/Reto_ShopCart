// Esquemas Zod y tipos compartidos entre la API y la web; se llenan módulo por módulo.
export {
  contrasenaSchema,
  correoSchema,
  loginSchema,
  registroSchema,
  type DatosLogin,
  type DatosRegistro,
} from './auth.js';
export { LARGO_MAXIMO_TEXTO_BUSQUEDA } from './catalogo.js';
export { montoSchema } from './monto.js';
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
