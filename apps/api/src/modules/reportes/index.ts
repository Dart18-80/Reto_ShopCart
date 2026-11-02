import type { RequestHandler, Router } from 'express';
import { crearReportesController } from './reportes.controller.js';
import { reportesRepository } from './reportes.repository.js';
import { crearReportesRouter } from './reportes.routes.js';

interface DependenciasReportes {
  autenticar: RequestHandler;
}

/** Monta /dashboard (Admin). */
export function crearModuloReportes({ autenticar }: DependenciasReportes): Router {
  return crearReportesRouter(crearReportesController(reportesRepository), autenticar);
}
