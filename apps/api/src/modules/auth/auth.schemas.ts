import { textoNvarchar } from '@shopcart/shared';
import { ROLES_DE_USUARIO } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';

// N-15: mínimo 8 caracteres con letras y números. El máximo evita que un cuerpo enorme se vuelva trabajo
// de argon2. Las contraseñas no se recortan: los espacios son parte de ellas.
const contrasenaSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres.')
  .max(128, 'Máximo 128 caracteres.')
  .regex(/\p{L}/u, 'Debe incluir al menos una letra.')
  .regex(/\d/, 'Debe incluir al menos un número.');

// Usuario.Correo es NVARCHAR(254).
const correoSchema = textoNvarchar(254).pipe(z.email('El correo no es válido.'));

export const registroSchema = z
  .object({
    correo: correoSchema,
    contrasena: contrasenaSchema,
    nombre: textoNvarchar(100),
    telefono: z
      .string()
      .regex(/^\d{8}$/, 'El teléfono debe tener 8 dígitos.')
      .optional(),
  })
  .strict()
  .openapi('Registro');

// En el login no se valida la forma de la contraseña: cualquier fallo responde el mismo 401 (N-15).
export const loginSchema = z
  .object({
    correo: textoNvarchar(254),
    contrasena: z.string().min(1).max(128),
  })
  .strict()
  .openapi('Login');

export const sesionSchema = z
  .object({
    accessToken: z
      .string()
      .openapi({ description: 'JWT de 15 minutos: header Authorization: Bearer' }),
    expiraEn: z.number().int().openapi({ description: 'Segundos de vigencia del access token' }),
    usuario: z.object({
      idUsuario: z.number().int(),
      correo: z.string(),
      nombre: z.string(),
      rol: z.enum(ROLES_DE_USUARIO),
    }),
  })
  .openapi('Sesion');

export const respuestaSesionSchema = z.object({ datos: sesionSchema });

export type DatosRegistro = z.infer<typeof registroSchema>;
export type DatosLogin = z.infer<typeof loginSchema>;
