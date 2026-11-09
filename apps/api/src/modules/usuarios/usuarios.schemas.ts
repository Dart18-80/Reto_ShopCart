import {
  actualizarPerfilSchema as actualizarPerfilCompartido,
  actualizarUsuarioSchema as actualizarUsuarioCompartido,
  cambiarContrasenaSchema as cambiarContrasenaCompartido,
  consultaUsuariosSchema,
  crearUsuarioInternoSchema,
  type ordenUsuariosSchema,
} from '@shopcart/shared';
import { idEnRutaSchema, ROLES_DE_USUARIO } from '../../shared/http/index.js';
import { registroOpenApi } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';

// FE-03: los esquemas del perfil propio y de los usuarios del Admin viven en @shopcart/shared, los mismos que valida
// la web (M10-H01).
export const actualizarPerfilSchema = registroOpenApi.register(
  'ActualizarPerfil',
  actualizarPerfilCompartido,
);
export const cambiarContrasenaSchema = registroOpenApi.register(
  'CambiarContrasena',
  cambiarContrasenaCompartido,
);

export type OrdenUsuarios = z.infer<typeof ordenUsuariosSchema>;

export const listarUsuariosSchema = consultaUsuariosSchema;

export const crearInternoSchema = registroOpenApi.register(
  'CrearUsuarioInterno',
  crearUsuarioInternoSchema,
);

export const actualizarUsuarioSchema = registroOpenApi.register(
  'ActualizarUsuario',
  actualizarUsuarioCompartido,
);

export const paramsIdUsuarioSchema = z.object({ id: idEnRutaSchema });

export const usuarioSchema = z
  .object({
    idUsuario: z.number().int(),
    correo: z.string(),
    nombre: z.string(),
    telefono: z.string().nullable(),
    rol: z.enum(ROLES_DE_USUARIO),
    activo: z.boolean(),
    fechaCreacion: z.iso.datetime().openapi({ description: 'M10-H01: cuándo se creó (UTC)' }),
  })
  .openapi('Usuario');

export type { ActualizarPerfil, CambiarContrasena } from '@shopcart/shared';
export type CrearInterno = z.infer<typeof crearInternoSchema>;
export type ActualizarUsuario = z.infer<typeof actualizarUsuarioSchema>;
