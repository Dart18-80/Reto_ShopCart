import { z } from 'zod';
import { contrasenaSchema, correoSchema } from './auth.js';
import { booleanoConsultaSchema, consultaPaginacionSchema } from './consultas.js';
import { ordenConsultaSchema } from './orden.js';
import { ROLES_DE_USUARIO } from './roles.js';
import { telefonoSchema } from './telefono.js';
import { textoNvarchar } from './texto.js';

/** Un PATCH sin campos no tiene nada que cambiar. */
export const alMenosUnCampo = (cambios: object) => Object.keys(cambios).length > 0;

// RF-01: el cliente nunca manda su ID; .strict() rechaza cualquier campo que no sea editable.
export const actualizarPerfilSchema = z
  .object({ nombre: textoNvarchar(100).optional(), telefono: telefonoSchema.nullable().optional() })
  .strict()
  .refine(alMenosUnCampo, 'Indica al menos un campo.');

export const cambiarContrasenaSchema = z
  .object({ contrasenaActual: z.string().min(1).max(128), contrasenaNueva: contrasenaSchema })
  .strict();

export type ActualizarPerfil = z.infer<typeof actualizarPerfilSchema>;
export type CambiarContrasena = z.infer<typeof cambiarContrasenaSchema>;

// --- Usuarios del Admin (E2-H04; M10-H01 los usa en el backoffice, FE-03).

/** N-15: los internos que crea el Admin; los Clientes solo se registran. */
export const ROLES_INTERNOS = ['Operador', 'Administrador'] as const;

export const ordenUsuariosSchema = ordenConsultaSchema(
  ['nombre', 'correo', 'rol', 'recientes'],
  'recientes',
  'desc',
);

export const consultaUsuariosSchema = consultaPaginacionSchema.extend({
  ...ordenUsuariosSchema.shape,
  rol: z.enum(ROLES_DE_USUARIO).optional(),
  activo: booleanoConsultaSchema.optional(),
});

export const crearUsuarioInternoSchema = z
  .object({
    correo: correoSchema,
    contrasena: contrasenaSchema,
    nombre: textoNvarchar(100),
    telefono: telefonoSchema.optional(),
    rol: z.enum(ROLES_INTERNOS),
  })
  .strict();

export const actualizarUsuarioSchema = z
  .object({ nombre: textoNvarchar(100).optional(), rol: z.enum(ROLES_DE_USUARIO).optional() })
  .strict()
  .refine(alMenosUnCampo, 'Indica al menos un campo.');

export type OrdenUsuarios = z.infer<typeof ordenUsuariosSchema>;
export type ConsultaUsuarios = z.infer<typeof consultaUsuariosSchema>;
export type CrearUsuarioInterno = z.infer<typeof crearUsuarioInternoSchema>;
export type ActualizarUsuario = z.infer<typeof actualizarUsuarioSchema>;
