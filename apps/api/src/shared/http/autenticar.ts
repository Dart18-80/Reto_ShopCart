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

/** El token de un encabezado `Authorization: Bearer …`; undefined si no lo hay. */
export function tokenDeAutorizacion(encabezado: string | undefined): string | undefined {
  return BEARER.exec(encabezado ?? '')?.[1];
}

const tokenDe = (req: Request): string | undefined => tokenDeAutorizacion(req.get('Authorization'));

/** A-07: el token es de una versión de sesión anterior (el usuario se desactivó, cambió de rol o de contraseña). */
export async function sesionRevocada(
  { idUsuario, versionSesion }: ActorDelToken,
  versiones: Pick<VersionesSesion, 'vigente'>,
): Promise<boolean> {
  const vigente = await versiones.vigente(idUsuario);
  return vigente !== null && versionSesion < vigente;
}

/**
 * A-07: verifica el access token (firma, vencimiento, forma y versión de sesión) y deja al usuario en el
 * contexto de la petición. Cualquier falla responde 401 NO_AUTENTICADO.
 */
export function crearAutenticar({ tokens, versiones }: DependenciasAutenticar): RequestHandler {
  return async (req, _res, next) => {
    const token = tokenDe(req);
    const actor = token === undefined ? null : await tokens.verificar(token);
    if (actor === null || (await sesionRevocada(actor, versiones))) {
      next(new AppError('NO_AUTENTICADO'));
      return;
    }
    establecerUsuario(actor.idUsuario, actor.rol);
    next();
  };
}

/**
 * N-05: rutas que también atienden a invitados. Sin Authorization sigue como anónimo; con él, lo verifica
 * `autenticar`: un token inválido o vencido responde 401 y nunca cae a invitado.
 */
export function autenticarOpcional(autenticar: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (req.get('Authorization') === undefined) {
      next();
      return;
    }
    return autenticar(req, res, next);
  };
}

/** Con sesión, solo los roles indicados; sin sesión pasa como invitado. Va después de autenticarOpcional. */
export function autorizarSiHaySesion(...roles: Rol[]): RequestHandler {
  return (_req, _res, next) => {
    const rol = obtenerContexto()?.rol ?? null;
    next(rol === null || roles.includes(rol) ? undefined : new AppError('SIN_PERMISO'));
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
