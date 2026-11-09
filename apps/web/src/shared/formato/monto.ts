// Así llegan los montos del backend: texto decimal ("149.90", "-12.00"; A-21).
const PATRON_MONTO = /^-?\d+(\.\d+)?$/;

const esMonto = (texto: string): texto is Intl.StringNumericLiteral => PATRON_MONTO.test(texto);

const formatoQuetzales = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

/**
 * FE-10: el monto del backend en quetzales, sin calcular nada. Intl recibe el texto y lo trata como decimal
 * exacto, así el monto nunca pasa por `number`. Figma escribe «Q578.00»: se quita el espacio que es-GT pone
 * entre el símbolo y la cifra.
 */
export function formatearMonto(monto: string): string {
  if (!esMonto(monto)) {
    throw new Error(
      `«${monto}» no es un monto: el backend los manda como texto decimal ("149.90").`,
    );
  }
  return formatoQuetzales
    .formatToParts(monto)
    .filter((parte) => parte.type !== 'literal')
    .map((parte) => parte.value)
    .join('');
}

/**
 * FE-10: un porcentaje del backend (texto decimal, «12.50») como lo lee la persona: «12.5 %». Solo quita los ceros
 * sobrantes del texto; no lo convierte a `number`.
 */
export function formatearPorcentaje(valor: string): string {
  if (!esMonto(valor)) {
    throw new Error(
      `«${valor}» no es un porcentaje: el backend lo manda como texto decimal ("10.00").`,
    );
  }
  const [enteros = '', decimales = ''] = valor.split('.');
  const significativos = decimales.replace(/0+$/, '');
  return `${enteros}${significativos === '' ? '' : `.${significativos}`} %`;
}
