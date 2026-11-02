import { telefonoSchema, textoNvarchar } from '@shopcart/shared';
import { ROLES_DE_USUARIO } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';

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
    avisosCarrito: z
      .array(
        z.object({
          idVariante: z.number().int(),
          producto: z.string(),
          tipo: z.enum(['CantidadAjustada', 'NoFusionada']),
          cantidadSolicitada: z.number().int(),
          cantidadFinal: z.number().int(),
        }),
      )
      .optional()
      .openapi({
        description:
          'Solo al iniciar sesión o registrarse: líneas del carrito de invitado que no pasaron completas al fusionarlo (N-05)',
      }),
  })
  .openapi('Sesion');

export const respuestaSesionSchema = z.object({ datos: sesionSchema });

// El refresh token llega en la cookie httpOnly (A-07): 43 caracteres base64url, 256 bits. Un valor que no
// puede ser uno cuenta como cookie ausente: el refresh responde 401 y el logout igual borra la cookie.
const LARGO_MAXIMO_REFRESH = 100;
export const cookiesRefreshSchema = z.object({
  refresh: z
    .string()
    .optional()
    .transform((valor) =>
      valor !== undefined && valor.length <= LARGO_MAXIMO_REFRESH ? valor : undefined,
    ),
});

export type DatosRegistro = z.infer<typeof registroSchema>;
export type DatosLogin = z.infer<typeof loginSchema>;
