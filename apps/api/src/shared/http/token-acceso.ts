import { randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import type { Rol } from './contexto.js';

// A-07: access token de 15 minutos firmado con HS256.
export const VIGENCIA_ACCESO_SEG = 15 * 60;
const ALGORITMO = 'HS256';

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

export function crearTokensAcceso(secreto: string): TokensAcceso {
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
        if (!carga.success) return null;
        const { sub, rol, versionSesion } = carga.data;
        return { idUsuario: Number(sub), rol, versionSesion };
      } catch {
        // Firma inválida, token vencido o mal formado: todos son "no autenticado" para quien llama.
        return null;
      }
    },
  };
}

export function esRolDeUsuario(valor: string): valor is (typeof ROLES_DE_USUARIO)[number] {
  return (ROLES_DE_USUARIO as readonly string[]).includes(valor);
}
