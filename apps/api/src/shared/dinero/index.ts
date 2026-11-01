import { Decimal } from 'decimal.js';

const DECIMALES = 2;
// A-21: el mayor DECIMAL(15,2) es 9 999 999 999 999.99. Con 15 dígitos significativos un double lo
// representa sin error; desde 1e13 ya no hay garantía, así que se falla en lugar de redondear.
const LIMITE = new Decimal('1e13');

/**
 * A-21: único punto de entrada de un monto que viene de un SP (el driver entrega DECIMAL como number).
 * El number solo se convierte; nunca se usa para operar.
 */
export function aMonto(valor: number): Decimal {
  if (!Number.isFinite(valor)) {
    throw new Error(`A-21: monto no finito recibido de la base (${String(valor)}).`);
  }
  return verificarLimite(new Decimal(valor)).toDecimalPlaces(DECIMALES);
}

/** A-21: único punto de salida de un monto hacia un parámetro de SP (DECIMAL(12,2) o (15,2)). */
export function montoParaSql(monto: Decimal): number {
  return verificarLimite(monto).toDecimalPlaces(DECIMALES).toNumber();
}

function verificarLimite(monto: Decimal): Decimal {
  if (monto.abs().greaterThanOrEqualTo(LIMITE)) {
    throw new Error(`A-21: monto fuera del rango seguro de DECIMAL(15,2): ${monto.toString()}.`);
  }
  return monto;
}

/** A-21: único punto de salida de un monto hacia JSON: texto con dos decimales ("149.90"). */
export function montoATexto(monto: Decimal): string {
  return monto.toFixed(DECIMALES);
}
