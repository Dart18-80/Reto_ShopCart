import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ejecutarConContexto } from './contexto.js';

export const ENCABEZADO_REQUEST_ID = 'X-Request-Id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Abre el contexto de la petición. Respeta el X-Request-Id que llega (por ejemplo, de nginx) solo si es
 * un UUID: viaja a la base como UNIQUEIDENTIFIER y a los logs, así que no se acepta texto arbitrario.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const recibido = req.get(ENCABEZADO_REQUEST_ID);
  const id = recibido !== undefined && UUID.test(recibido) ? recibido.toLowerCase() : randomUUID();
  res.setHeader(ENCABEZADO_REQUEST_ID, id);
  ejecutarConContexto({ requestId: id, idUsuario: null, rol: null }, next);
}
