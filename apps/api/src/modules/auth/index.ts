import type { Router } from 'express';
import type { ClienteHttp, TokensAcceso } from '../../shared/http/index.js';
import { crearAuthController } from './auth.controller.js';
import { authRepository } from './auth.repository.js';
import { crearAuthRouter, type LimitadoresAuth } from './auth.routes.js';
import { crearAuthService } from './auth.service.js';
import type { Sesion, UsuarioSesion } from './auth.types.js';

export type { LimitadoresAuth } from './auth.routes.js';
export type { Sesion, UsuarioSesion } from './auth.types.js';
export { enviarSesion } from './auth.controller.js';
export { hashearContrasena, verificarContrasena } from './auth.contrasenas.js';
export { contrasenaSchema, correoSchema } from './auth.schemas.js';

interface DependenciasAuth {
  tokens: TokensAcceso;
  limitadores: LimitadoresAuth;
}

export function crearModuloAuth({ tokens, limitadores }: DependenciasAuth): Router {
  const servicio = crearAuthService({ repositorio: authRepository, tokens });
  return crearAuthRouter(crearAuthController(servicio), limitadores);
}

/** Abre una sesión nueva (A-07) para otros módulos, por ejemplo tras cambiar la contraseña. */
export interface Sesiones {
  abrir(usuario: UsuarioSesion, cliente: ClienteHttp): Promise<Sesion>;
}

export function crearSesiones(tokens: TokensAcceso): Sesiones {
  const servicio = crearAuthService({ repositorio: authRepository, tokens });
  return { abrir: (usuario, cliente) => servicio.abrirSesion(usuario, cliente) };
}
