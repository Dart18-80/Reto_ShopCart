import { z } from 'zod';
import { telefonoSchema } from './telefono.js';
import { textoNvarchar } from './texto.js';

// N-15: mínimo 8 caracteres con letras y números. El máximo evita que un cuerpo enorme se vuelva trabajo
// de argon2. Las contraseñas no se recortan: los espacios son parte de ellas.
export const contrasenaSchema = z
  .string()
  .min(8, 'Mínimo 8 caracteres.')
  .max(128, 'Máximo 128 caracteres.')
  .regex(/\p{L}/u, 'Debe incluir al menos una letra.')
  .regex(/\d/, 'Debe incluir al menos un número.');

// Usuario.Correo es NVARCHAR(254).
export const correoSchema = textoNvarchar(254).pipe(z.email('El correo no es válido.'));

export const registroSchema = z
  .object({
    correo: correoSchema,
    contrasena: contrasenaSchema,
    nombre: textoNvarchar(100),
    telefono: telefonoSchema.optional(),
  })
  .strict();

// En el login no se valida la forma de la contraseña: cualquier fallo responde el mismo 401 (N-15).
export const loginSchema = z
  .object({
    correo: textoNvarchar(254),
    contrasena: z.string().min(1).max(128),
  })
  .strict();

export type DatosRegistro = z.infer<typeof registroSchema>;
export type DatosLogin = z.infer<typeof loginSchema>;
