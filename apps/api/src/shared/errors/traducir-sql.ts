import { z } from 'zod';
import { AppError } from './app-error.js';
import { codigoPorNumeroSql } from './catalogo.js';

const RANGO_NEGOCIO = { desde: 50000, hasta: 59999 } as const;

// A-19: un THROW que necesita datos estructurados envía un JSON { mensaje, detalles }.
const mensajeEstructuradoSchema = z.object({ mensaje: z.string().min(1), detalles: z.unknown() });

export function numeroErrorSql(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('number' in error)) return undefined;
  return typeof error.number === 'number' ? error.number : undefined;
}

export function traducirErrorSql(error: unknown): AppError | undefined {
  const numero = numeroErrorSql(error);
  if (numero === undefined || numero < RANGO_NEGOCIO.desde || numero > RANGO_NEGOCIO.hasta) {
    return undefined;
  }

  const codigo = codigoPorNumeroSql(numero);
  if (codigo === undefined) {
    // Un número sin catalogar es un error de programación: no se muestra el mensaje del SP.
    return new AppError('ERROR_INTERNO', undefined, undefined, { cause: error });
  }

  const { mensaje, detalles } = separarMensaje(error instanceof Error ? error.message : '');
  return new AppError(codigo, mensaje, detalles, { cause: error });
}

function separarMensaje(texto: string): { mensaje: string | undefined; detalles: unknown } {
  if (!texto.trimStart().startsWith('{')) {
    return { mensaje: texto.length > 0 ? texto : undefined, detalles: undefined };
  }
  try {
    const resultado = mensajeEstructuradoSchema.safeParse(JSON.parse(texto));
    if (resultado.success) return resultado.data;
  } catch {
    // JSON mal formado: se cae al mensaje del catálogo para no mostrar texto técnico.
  }
  return { mensaje: undefined, detalles: undefined };
}
