import { z } from 'zod';
import { AppError } from './app-error.js';
import { CATALOGO, codigoPorNumeroSql } from './catalogo.js';

const RANGO_NEGOCIO = { desde: 50000, hasta: 59999 } as const;
const PRIMER_ERROR_INTERNO = 500;

// A-19: un THROW que necesita datos estructurados envía un JSON { mensaje, detalles }.
const mensajeEstructuradoSchema = z.object({ mensaje: z.string().min(1), detalles: z.unknown() });

export function numeroErrorSql(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('number' in error)) return undefined;
  return typeof error.number === 'number' ? error.number : undefined;
}

function esDeNegocio(numero: number | undefined): numero is number {
  return numero !== undefined && numero >= RANGO_NEGOCIO.desde && numero <= RANGO_NEGOCIO.hasta;
}

export function traducirErrorSql(error: unknown): AppError | undefined {
  const numero = numeroErrorSql(error);
  if (!esDeNegocio(numero)) return undefined;

  const codigo = codigoPorNumeroSql(numero);
  if (codigo === undefined) {
    // Un número sin catalogar es un error de programación: no se muestra el mensaje del SP.
    return new AppError('ERROR_INTERNO', { cause: error });
  }

  // Un 5xx es un error de programación: el texto del SP queda en la causa (el log), no en la respuesta.
  if (CATALOGO[codigo].http >= PRIMER_ERROR_INTERNO) return new AppError(codigo, { cause: error });

  const { mensaje, detalles } = separarMensaje(error instanceof Error ? error.message : '');
  return new AppError(codigo, { mensaje, detalles, cause: error });
}

/**
 * A-19: un THROW de negocio cuyo mensaje empieza con `{` pero no es un `{ mensaje, detalles }` válido.
 * El cliente recibe el mensaje del catálogo; quien llama lo registra porque es un error del SP.
 */
export function tieneMensajeEstructuradoInvalido(error: unknown): boolean {
  if (!esDeNegocio(numeroErrorSql(error)) || !(error instanceof Error)) return false;
  return esEstructurado(error.message) && leerEstructurado(error.message) === undefined;
}

function esEstructurado(texto: string): boolean {
  return texto.trimStart().startsWith('{');
}

function leerEstructurado(texto: string): z.infer<typeof mensajeEstructuradoSchema> | undefined {
  try {
    const resultado = mensajeEstructuradoSchema.safeParse(JSON.parse(texto));
    return resultado.success ? resultado.data : undefined;
  } catch {
    // JSON mal formado: lo reporta tieneMensajeEstructuradoInvalido.
    return undefined;
  }
}

function separarMensaje(texto: string): { mensaje: string | undefined; detalles: unknown } {
  if (!esEstructurado(texto)) {
    return { mensaje: texto.length > 0 ? texto : undefined, detalles: undefined };
  }
  // Inválido: se cae al mensaje del catálogo para no mostrar texto técnico al cliente.
  return leerEstructurado(texto) ?? { mensaje: undefined, detalles: undefined };
}
