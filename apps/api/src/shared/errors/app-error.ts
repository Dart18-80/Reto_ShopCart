import { CATALOGO, type CodigoError } from './catalogo.js';

/** Error esperado: se responde al cliente con su código estable y el HTTP del catálogo (A-06). */
export class AppError extends Error {
  readonly codigo: CodigoError;
  readonly status: number;
  readonly detalles: unknown;

  constructor(codigo: CodigoError, mensaje?: string, detalles?: unknown, opciones?: ErrorOptions) {
    const entrada = CATALOGO[codigo];
    super(mensaje ?? entrada.mensaje, opciones);
    this.name = 'AppError';
    this.codigo = codigo;
    this.status = entrada.http;
    this.detalles = detalles;
  }
}
