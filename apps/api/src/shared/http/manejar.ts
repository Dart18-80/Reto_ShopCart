import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { leerCookies } from './cookies.js';

interface EsquemasEntrada {
  params?: z.ZodType;
  body?: z.ZodType;
  query?: z.ZodType;
  /** Cookies del header Cookie (por ejemplo, el refresh token de A-07). */
  cookies?: z.ZodType;
  /** Encabezados, con los nombres en minúsculas (por ejemplo, Idempotency-Key de N-03). */
  encabezados?: z.ZodType;
}

type Parte = keyof EsquemasEntrada;

const PARTES: readonly Parte[] = ['params', 'query', 'body', 'cookies', 'encabezados'];

// RefreshToken.UserAgent es NVARCHAR(300).
const LARGO_MAXIMO_USER_AGENT = 300;

/** Quién hace la petición, para registrar una sesión (A-07). */
export interface ClienteHttp {
  ip: string | null;
  userAgent: string | null;
}

/** Lo que recibe el handler: cada parte con el tipo de su esquema, o undefined si no tiene esquema. */
export type Entrada<E extends EsquemasEntrada> = {
  [P in Parte]: P extends keyof E
    ? E[P] extends z.ZodType
      ? z.infer<E[P]>
      : undefined
    : undefined;
} & { cliente: ClienteHttp };

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
    // express.json() ignora un cuerpo declarado con otro tipo y el esquema vería un body vacío: el
    // problema real es el tipo de contenido, no los campos.
    const tipoDeclarado = req.get('Content-Type') !== undefined;
    if (esquemas.body !== undefined && tipoDeclarado && req.is('application/json') === false) {
      next(new AppError('CONTENIDO_NO_SOPORTADO'));
      return;
    }
    const errores: ErrorDeCampo[] = [];
    const entrada = {
      ...Object.fromEntries(
        PARTES.map((parte) => [parte, validarParte(req, parte, esquemas[parte], errores)]),
      ),
      cliente: clienteDe(req),
    };
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

  const crudo: unknown =
    parte === 'cookies'
      ? leerCookies(req.get('Cookie'))
      : parte === 'encabezados'
        ? req.headers
        : req[parte];
  const validacion = esquema.safeParse(crudo);
  if (validacion.success) return validacion.data;

  for (const problema of validacion.error.issues) {
    errores.push({ campo: [parte, ...problema.path].join('.'), mensaje: problema.message });
  }
  return undefined;
}

function clienteDe(req: Request): ClienteHttp {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('User-Agent')?.slice(0, LARGO_MAXIMO_USER_AGENT) ?? null,
  };
}
