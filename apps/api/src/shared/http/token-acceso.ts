import { randomUUID } from 'node:crypto';
import { errors, jwtVerify, SignJWT } from 'jose';
import type { Logger } from 'pino';
import { ROLES_DE_USUARIO } from '@shopcart/shared';
import { z } from 'zod';

// A-07: access token de 15 minutos firmado con HS256.
export const VIGENCIA_ACCESO_SEG = 15 * 60;
const ALGORITMO = 'HS256';
// Lo único esperado en el día a día: un frontend que todavía no renovó su access token.
const EXPIRACION_NORMAL = 'ERR_JWT_EXPIRED';

// Solo roles de usuario (sin 'Sistema', A-18); la lista vive en @shopcart/shared porque la web también la usa.
export { ROLES_DE_USUARIO };

const cargaSchema = z.object({
  sub: z.string().regex(/^[1-9]\d*$/),
  rol: z.enum(ROLES_DE_USUARIO),
  jti: z.string().min(1),
  // A-07: autenticar rechaza el token si la versión de sesión del usuario ya subió.
  versionSesion: z.number().int().min(0),
  exp: z.number().int().positive(),
});

export type RolDeUsuario = (typeof ROLES_DE_USUARIO)[number];

const MS_POR_SEGUNDO = 1000;

export interface ActorDelToken {
  idUsuario: number;
  rol: RolDeUsuario;
  versionSesion: number;
}

/** Un token válido: su actor y cuándo vence (E9-H02: el stream del dashboard se cierra a esa hora). */
export interface TokenVerificado extends ActorDelToken {
  venceEn: Date;
}

export interface TokensAcceso {
  emitir(actor: ActorDelToken): Promise<string>;
  /** null si la firma no es válida, si venció o si su contenido no cumple el esquema. */
  verificar(token: string): Promise<TokenVerificado | null>;
}

/**
 * Un rechazo responde 401 igual, pero queda su motivo en el log (nunca el token): una firma inválida en
 * una sola réplica delata un JWT_SECRETO distinto entre réplicas.
 */
function registrarRechazo(logger: Logger, error: unknown): void {
  if (!(error instanceof errors.JOSEError)) {
    logger.error({ err: error }, 'Error inesperado al verificar un access token');
    return;
  }
  if (error.code === EXPIRACION_NORMAL) {
    logger.debug({ codigo: error.code }, 'Access token vencido');
    return;
  }
  logger.warn({ codigo: error.code }, 'Access token rechazado');
}

export function crearTokensAcceso(secreto: string, logger: Logger): TokensAcceso {
  const clave = new TextEncoder().encode(secreto);
  return {
    emitir: ({ idUsuario, rol, versionSesion }) =>
      new SignJWT({ rol, versionSesion })
        .setProtectedHeader({ alg: ALGORITMO })
        .setSubject(String(idUsuario))
        .setJti(randomUUID())
        .setIssuedAt()
        .setExpirationTime(`${String(VIGENCIA_ACCESO_SEG)}s`)
        .sign(clave),

    async verificar(token) {
      try {
        const { payload } = await jwtVerify(token, clave, {
          algorithms: [ALGORITMO],
          requiredClaims: ['exp', 'iat', 'jti', 'sub'],
        });
        const carga = cargaSchema.safeParse(payload);
        if (!carga.success) {
          // Firmado con nuestro secreto pero con otra forma: un error de programación o un secreto filtrado.
          logger.warn(
            { codigo: 'CARGA_INVALIDA' },
            'Access token con firma válida y carga inválida',
          );
          return null;
        }
        const { sub, rol, versionSesion, exp } = carga.data;
        return {
          idUsuario: Number(sub),
          rol,
          versionSesion,
          venceEn: new Date(exp * MS_POR_SEGUNDO),
        };
      } catch (error) {
        // Firma inválida, token vencido o mal formado: todos son "no autenticado" para quien llama.
        registrarRechazo(logger, error);
        return null;
      }
    },
  };
}

/** Rol leído de la base: un rol que no es de usuario (por ejemplo, Sistema) es un error de datos. */
export function aRolDeUsuario(rol: string): RolDeUsuario {
  if (!(ROLES_DE_USUARIO as readonly string[]).includes(rol)) {
    throw new Error(`Rol inesperado desde la base: ${rol}`);
  }
  return rol as RolDeUsuario;
}
