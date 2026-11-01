import type { RequestHandler, Router } from 'express';
import { crearInventarioController } from './inventario.controller.js';
import { inventarioRepository } from './inventario.repository.js';
import { crearInventarioRouter } from './inventario.routes.js';
import { crearInventarioService } from './inventario.service.js';

interface DependenciasInventario {
  autenticar: RequestHandler;
}

/** Monta /inventario (Operador y Admin). */
export function crearModuloInventario({ autenticar }: DependenciasInventario): Router {
  const servicio = crearInventarioService({ repositorio: inventarioRepository });
  return crearInventarioRouter(crearInventarioController(servicio), autenticar);
}
