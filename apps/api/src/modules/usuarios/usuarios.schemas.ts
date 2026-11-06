import {
  actualizarPerfilSchema as actualizarPerfilCompartido,
  alMenosUnCampo,
  cambiarContrasenaSchema as cambiarContrasenaCompartido,
  ordenConsultaSchema,
  telefonoSchema,
  textoNvarchar,
} from '@shopcart/shared';
import {
  consultaPaginacionSchema,
  idEnRutaSchema,
  ROLES_DE_USUARIO,
} from '../../shared/http/index.js';
import { registroOpenApi } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import { contrasenaSchema, correoSchema } from '../auth/index.js';

// N-15: los internos que crea el Admin; los Clientes solo se registran.
const ROLES_INTERNOS = ['Operador', 'Administrador'] as const;

// FE-03: los esquemas del perfil propio viven en @shopcart/shared, los mismos que valida la web.
export const actualizarPerfilSchema = registroOpenApi.register(
  'ActualizarPerfil',
  actualizarPerfilCompartido,
);
export const cambiarContrasenaSchema = registroOpenApi.register(
  'CambiarContrasena',
  cambiarContrasenaCompartido,
);

export const ordenUsuariosSchema = ordenConsultaSchema(
  ['nombre', 'correo', 'rol', 'recientes'],
  'recientes',
  'desc',
);

export type OrdenUsuarios = z.infer<typeof ordenUsuariosSchema>;

export const listarUsuariosSchema = consultaPaginacionSchema.extend({
  ...ordenUsuariosSchema.shape,
  rol: z.enum(ROLES_DE_USUARIO).optional(),
  activo: z
    .enum(['true', 'false'])
    .transform((valor) => valor === 'true')
    .optional(),
});

export const crearInternoSchema = z
  .object({
    correo: correoSchema,
    contrasena: contrasenaSchema,
    nombre: textoNvarchar(100),
    telefono: telefonoSchema.optional(),
    rol: z.enum(ROLES_INTERNOS),
  })
  .strict()
  .openapi('CrearUsuarioInterno');

export const actualizarUsuarioSchema = z
  .object({ nombre: textoNvarchar(100).optional(), rol: z.enum(ROLES_DE_USUARIO).optional() })
  .strict()
  .refine(alMenosUnCampo, 'Indica al menos un campo.')
  .openapi('ActualizarUsuario');

export const paramsIdUsuarioSchema = z.object({ id: idEnRutaSchema });

export const usuarioSchema = z
  .object({
    idUsuario: z.number().int(),
    correo: z.string(),
    nombre: z.string(),
    telefono: z.string().nullable(),
    rol: z.enum(ROLES_DE_USUARIO),
    activo: z.boolean(),
  })
  .openapi('Usuario');

export type { ActualizarPerfil, CambiarContrasena } from '@shopcart/shared';
export type CrearInterno = z.infer<typeof crearInternoSchema>;
export type ActualizarUsuario = z.infer<typeof actualizarUsuarioSchema>;
