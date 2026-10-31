import { textoNvarchar } from '@shopcart/shared';
import { consultaPaginacionSchema, ROLES_DE_USUARIO } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';
import { contrasenaSchema, correoSchema } from '../auth/index.js';

const telefonoSchema = z.string().regex(/^\d{8}$/, 'El teléfono debe tener 8 dígitos.');

// N-15: los internos que crea el Admin; los Clientes solo se registran.
const ROLES_INTERNOS = ['Operador', 'Administrador'] as const;

const alMenosUnCampo = (cambios: object) => Object.keys(cambios).length > 0;

// RF-01: el cliente nunca manda su ID; .strict() rechaza cualquier campo que no sea editable.
export const actualizarPerfilSchema = z
  .object({ nombre: textoNvarchar(100).optional(), telefono: telefonoSchema.nullable().optional() })
  .strict()
  .refine(alMenosUnCampo, 'Indica al menos un campo.')
  .openapi('ActualizarPerfil');

export const cambiarContrasenaSchema = z
  .object({ contrasenaActual: z.string().min(1).max(128), contrasenaNueva: contrasenaSchema })
  .strict()
  .openapi('CambiarContrasena');

export const listarUsuariosSchema = consultaPaginacionSchema.extend({
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

export const paramsIdUsuarioSchema = z.object({ id: z.coerce.number().int().positive() });

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

export type ActualizarPerfil = z.infer<typeof actualizarPerfilSchema>;
export type CambiarContrasena = z.infer<typeof cambiarContrasenaSchema>;
export type CrearInterno = z.infer<typeof crearInternoSchema>;
export type ActualizarUsuario = z.infer<typeof actualizarUsuarioSchema>;
