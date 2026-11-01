import { randomUUID } from 'node:crypto';
import { errors, jwtVerify, SignJWT } from 'jose';
import type { Logger } from 'pino';
import { z } from 'zod';
import type { Rol } from './contexto.js';

// A-07: access token de 15 minutos firmado con HS256.
export const VIGENCIA_ACCESO_SEG = 15 * 60;
const ALGORITMO = 'HS256';
// Lo único esperado en el día a día: un frontend que todavía no renovó su access token.
const EXPIRACION_NORMAL = 'ERR_JWT_EXPIRED';

// Solo roles de usuario: 'Sistema' es el rol de los jobs y del migrador (A-18) y ningún token lo trae.
export const ROLES_DE_USUARIO = ['Cliente', 'Operador', 'Administrador'] as const satisfies Rol[];

const cargaSchema = z.object({
  sub: z.string().regex(/^[1-9]\d*$/),
  rol: z.enum(ROLES_DE_USUARIO),
  jti: z.string().min(1),
  // A-07: autenticar rechaza el token si la versión de sesión del usuario ya subió.
  versionSesion: z.number().int().min(0),
});

export interface ActorDelToken {
  idUsuario: number;
  rol: Rol;
  versionSesion: number;
}

export interface TokensAcceso {
  emitir(actor: ActorDelToken): Promise<string>;
  /** null si la firma no es válida, si venció o si su contenido no cumple el esquema. */
  verificar(token: string): Promise<ActorDelToken | null>;
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
        const { sub, rol, versionSesion } = carga.data;
        return { idUsuario: Number(sub), rol, versionSesion };
      } catch (error) {
        // Firma inválida, token vencido o mal formado: todos son "no autenticado" para quien llama.
        registrarRechazo(logger, error);
        return null;
      }
    },
  };
}

export function esRolDeUsuario(valor: string): valor is (typeof ROLES_DE_USUARIO)[number] {
  return (ROLES_DE_USUARIO as readonly string[]).includes(valor);
}
