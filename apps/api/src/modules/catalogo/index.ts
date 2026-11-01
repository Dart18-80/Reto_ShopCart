import type { RequestHandler, Router } from 'express';
import { crearCatalogoController } from './catalogo.controller.js';
import { catalogoRepository } from './catalogo.repository.js';
import { crearCatalogoRouter } from './catalogo.routes.js';
import { crearCatalogoService } from './catalogo.service.js';

interface DependenciasCatalogo {
  autenticar: RequestHandler;
}

/** Monta /categorias (público) y /admin/categorias (Admin). */
export function crearModuloCatalogo({ autenticar }: DependenciasCatalogo): Router {
  const servicio = crearCatalogoService({ repositorio: catalogoRepository });
  return crearCatalogoRouter(crearCatalogoController(servicio), autenticar);
}
