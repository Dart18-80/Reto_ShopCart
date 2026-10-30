import { CATALOGO, type CodigoError } from './catalogo.js';

export interface OpcionesAppError {
  /** Mensaje para el usuario; si falta, el del catálogo. */
  mensaje?: string;
  detalles?: unknown;
  cause?: unknown;
}

/** Error esperado: se responde al cliente con su código estable y el HTTP del catálogo (A-06). */
export class AppError extends Error {
  readonly codigo: CodigoError;
  readonly status: number;
  readonly detalles: unknown;

  constructor(codigo: CodigoError, { mensaje, detalles, cause }: OpcionesAppError = {}) {
    const entrada = CATALOGO[codigo];
    super(mensaje ?? entrada.mensaje, { cause });
    this.name = 'AppError';
    this.codigo = codigo;
    this.status = entrada.http;
    this.detalles = detalles;
  }
}
