/**
 * Un BIGINT llega del driver como texto. Se convierte a number solo si es un entero seguro (hasta 2^53 - 1);
 * si no, falla en voz alta en lugar de perder precisión.
 */
export function bigintANumero(valor: string | number, columna: string): number {
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero)) {
    throw new Error(`${columna} = ${String(valor)} no cabe como entero seguro en JavaScript.`);
  }
  return numero;
}
