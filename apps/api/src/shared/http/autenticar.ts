import type { Request, RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';
import { establecerUsuario, obtenerContexto, type Rol } from './contexto.js';
import type { TokensAcceso } from './token-acceso.js';

/** N-15: usuarios desactivados cuyo access token todavía no vence. Adaptador: ListaRevocadosRedis. */
export interface ListaRevocados {
  estaRevocado(idUsuario: number): Promise<boolean>;
  revocar(idUsuario: number): Promise<void>;
}

interface DependenciasAutenticar {
  tokens: TokensAcceso;
  listaRevocados: ListaRevocados;
}

const BEARER = /^Bearer\s+(\S+)$/i;

function tokenDe(req: Request): string | undefined {
  return BEARER.exec(req.get('Authorization') ?? '')?.[1];
}

/**
 * A-07: verifica el access token (firma, vencimiento y forma) y la lista de revocados, y deja al usuario
 * en el contexto de la petición. Cualquier falla responde 401 NO_AUTENTICADO.
 */
export function crearAutenticar({
  tokens,
  listaRevocados,
}: DependenciasAutenticar): RequestHandler {
  return async (req, _res, next) => {
    const token = tokenDe(req);
    const actor = token === undefined ? null : await tokens.verificar(token);
    if (actor === null || (await listaRevocados.estaRevocado(actor.idUsuario))) {
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
