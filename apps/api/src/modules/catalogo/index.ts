import type { RequestHandler, Router } from 'express';
import type { InvalidadorReportes } from '../reportes/index.js';
import { crearCatalogoController } from './catalogo.controller.js';
import { catalogoRepository } from './catalogo.repository.js';
import { crearCatalogoRouter } from './catalogo.routes.js';
import { crearCatalogoService } from './catalogo.service.js';

interface DependenciasCatalogo {
  autenticar: RequestHandler;
  reportes: InvalidadorReportes;
}

/** Monta /categorias y /productos/:id (público) y la administración del catálogo en /admin (Admin). */
export function crearModuloCatalogo({ autenticar, reportes }: DependenciasCatalogo): Router {
  const servicio = crearCatalogoService({ repositorio: catalogoRepository, reportes });
  return crearCatalogoRouter(crearCatalogoController(servicio), autenticar);
}

export { ESTADOS_EXISTENCIA, type EstadoExistencia } from './catalogo.types.js';
