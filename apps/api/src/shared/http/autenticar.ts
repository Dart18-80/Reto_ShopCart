import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import { establecerUsuario, obtenerContexto, type Rol } from './contexto.js';
import type { ActorDelToken, TokensAcceso } from './token-acceso.js';

/**
 * A-07, N-15: versión de sesión vigente de cada usuario, publicada después de desactivarlo, cambiarle el
 * rol o cambiar su contraseña. Adaptador: VersionesSesionRedis.
 */
export interface VersionesSesion {
  /** null si no cambió hace poco o si Redis no responde: rige la ventana del access token (N-15). */
  vigente(idUsuario: number): Promise<number | null>;
  publicar(idUsuario: number, versionSesion: number): Promise<void>;
}

interface DependenciasAutenticar {
  tokens: TokensAcceso;
  versiones: Pick<VersionesSesion, 'vigente'>;
}

const BEARER = /^Bearer\s+(\S+)$/i;

function tokenDe(req: Request): string | undefined {
  return BEARER.exec(req.get('Authorization') ?? '')?.[1];
}

/**
 * A-07: verifica el access token (firma, vencimiento, forma y versión de sesión) y deja al usuario en el
 * contexto de la petición. Cualquier falla responde 401 NO_AUTENTICADO.
 */
export function crearAutenticar({ tokens, versiones }: DependenciasAutenticar): RequestHandler {
  async function esDeUnaVersionAnterior({ idUsuario, versionSesion }: ActorDelToken) {
    const vigente = await versiones.vigente(idUsuario);
    return vigente !== null && versionSesion < vigente;
  }

  return async (req, _res, next) => {
    const token = tokenDe(req);
    const actor = token === undefined ? null : await tokens.verificar(token);
    if (actor === null || (await esDeUnaVersionAnterior(actor))) {
      next(new AppError('NO_AUTENTICADO'));
      return;
    }
    establecerUsuario(actor.idUsuario, actor.rol);
    next();
  };
}

/** RF-01: solo los roles indicados. Va siempre después de autenticar. */
export function autorizar(...roles: Rol[]): RequestHandler {
  return (_req, _res, next) => {
    const rol = obtenerContexto()?.rol;
    if (rol === null || rol === undefined) {
      next(new AppError('NO_AUTENTICADO'));
      return;
    }
    next(roles.includes(rol) ? undefined : new AppError('SIN_PERMISO'));
  };
}
