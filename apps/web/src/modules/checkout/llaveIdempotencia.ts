const BYTES_UUID = 16;
const VERSION_4 = 0x40;
const VARIANTE_RFC = 0x80;
// Los cortes del texto de un UUID: 8-4-4-4-12 dígitos hexadecimales.
const GRUPOS = [8, 4, 4, 4, 12];

/**
 * RF-06: la llave de un intento de pago, un UUID v4 (el contrato la exige con formato uuid). Sale de
 * crypto.getRandomValues y no de crypto.randomUUID, que solo existe en contexto seguro (igual que Web Locks en
 * F1-H04): la tienda en http://localhost o por IP también debe poder pagar.
 */
export function nuevaLlaveDeIdempotencia(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(BYTES_UUID));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | VERSION_4;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | VARIANTE_RFC;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  let inicio = 0;
  return GRUPOS.map((largo) => {
    const grupo = hex.slice(inicio, inicio + largo);
    inicio += largo;
    return grupo;
  }).join('-');
}
