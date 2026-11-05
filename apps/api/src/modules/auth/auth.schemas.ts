import {
  contrasenaSchema,
  correoSchema,
  loginSchema as loginCompartido,
  registroSchema as registroCompartido,
} from '@shopcart/shared';
import { ROLES_DE_USUARIO } from '../../shared/http/index.js';
import { avisoFusionSchema } from '../carrito/index.js';
import { registroOpenApi } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';

// FE-03: los esquemas de entrada viven en @shopcart/shared, los mismos que valida la web; aquí se registran en OpenAPI
// con su nombre de componente.
export { contrasenaSchema, correoSchema };
export const registroSchema = registroOpenApi.register('Registro', registroCompartido);
export const loginSchema = registroOpenApi.register('Login', loginCompartido);

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
    avisosCarrito: z.array(avisoFusionSchema).optional().openapi({
      description:
        'Solo al iniciar sesión o registrarse (N-05): líneas del carrito de invitado que no pasaron completas, o FusionPendiente si no se pudo pasar (la cookie se conserva)',
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

export type { DatosLogin, DatosRegistro } from '@shopcart/shared';
