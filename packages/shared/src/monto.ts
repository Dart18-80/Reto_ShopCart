import { z } from 'zod';

/** A-21: un monto viaja en JSON como texto con hasta 10 enteros y 2 decimales (DECIMAL(12,2)). */
export const montoSchema = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'El monto debe tener hasta 10 enteros y 2 decimales.');

const ENTEROS_DE_UN_MONTO = 10;
const DECIMALES_DE_UN_MONTO = 2;

// Un monto válido escrito con ancho fijo («0000000100» + «50»): así dos montos se comparan como texto.
function anchoFijo(monto: string): string {
  const [enteros = '', decimales = ''] = monto.split('.');
  return enteros.padStart(ENTEROS_DE_UN_MONTO, '0') + decimales.padEnd(DECIMALES_DE_UN_MONTO, '0');
}

/** Si el monto `a` es menor o igual que `b`, sin convertirlos a `number` (FE-10). Ambos cumplen montoSchema. */
export const montoMenorOIgual = (a: string, b: string): boolean => anchoFijo(a) <= anchoFijo(b);
