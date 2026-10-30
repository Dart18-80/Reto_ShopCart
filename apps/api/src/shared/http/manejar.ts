import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';

interface EsquemasEntrada {
  params?: z.ZodType;
  body?: z.ZodType;
  query?: z.ZodType;
}

type Parte = keyof EsquemasEntrada;

const PARTES: readonly Parte[] = ['params', 'query', 'body'];

/** Lo que recibe el handler: cada parte con el tipo de su esquema, o undefined si no tiene esquema. */
export type Entrada<E extends EsquemasEntrada> = {
  [P in Parte]: P extends keyof E
    ? E[P] extends z.ZodType
      ? z.infer<E[P]>
      : undefined
    : undefined;
};

interface ErrorDeCampo {
  campo: string;
  mensaje: string;
}

/**
 * A-20: valida la entrada con Zod y llama al handler con los valores ya transformados y tipados.
 * No modifica req: en Express 5 req.query es de solo lectura.
 */
export function manejar<E extends EsquemasEntrada>(
  esquemas: E,
  handler: (entrada: Entrada<E>, res: Response) => void | Promise<void>,
): RequestHandler {
  return async (req, res, next) => {
    const errores: ErrorDeCampo[] = [];
    const entrada = Object.fromEntries(
      PARTES.map((parte) => [parte, validarParte(req, parte, esquemas[parte], errores)]),
    );
    if (errores.length > 0) {
      next(new AppError('VALIDACION_FALLIDA', { detalles: { errores } }));
      return;
    }
    // Las claves y los tipos de cada parte salen de los mismos esquemas que acaban de validarlas.
    await handler(entrada as Entrada<E>, res);
  };
}

function validarParte(
  req: Request,
  parte: Parte,
  esquema: z.ZodType | undefined,
  errores: ErrorDeCampo[],
): unknown {
  if (esquema === undefined) return undefined;

  const validacion = esquema.safeParse(req[parte]);
  if (validacion.success) return validacion.data;

  for (const problema of validacion.error.issues) {
    errores.push({ campo: [parte, ...problema.path].join('.'), mensaje: problema.message });
  }
  return undefined;
}
