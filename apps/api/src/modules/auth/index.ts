import type { Router } from 'express';
import type { TokensAcceso } from '../../shared/http/index.js';
import { crearAuthController } from './auth.controller.js';
import { authRepository } from './auth.repository.js';
import { crearAuthRouter, type LimitadoresAuth } from './auth.routes.js';
import { crearAuthService } from './auth.service.js';

export type { LimitadoresAuth } from './auth.routes.js';

interface DependenciasAuth {
  tokens: TokensAcceso;
  limitadores: LimitadoresAuth;
}

export function crearModuloAuth({ tokens, limitadores }: DependenciasAuth): Router {
  const servicio = crearAuthService({ repositorio: authRepository, tokens });
  return crearAuthRouter(crearAuthController(servicio), limitadores);
}
