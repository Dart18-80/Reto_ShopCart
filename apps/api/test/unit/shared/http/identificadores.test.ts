import { describe, expect, it } from 'vitest';
import { idBigintEnRutaSchema, idEnRutaSchema } from '../../../../src/shared/http/index.js';

const INT_MAXIMO = 2_147_483_647;

describe('identificadores en la ruta', () => {
  it('una PK INT rechaza un ID fuera de su rango (400, no un error de mssql)', () => {
    expect(idEnRutaSchema.safeParse(String(INT_MAXIMO)).success).toBe(true);
    expect(idEnRutaSchema.safeParse(String(INT_MAXIMO + 1)).success).toBe(false);
  });

  it('una PK BIGINT acepta un ID mayor que INT (IntentoPago)', () => {
    expect(idBigintEnRutaSchema.parse(String(INT_MAXIMO + 1))).toBe(INT_MAXIMO + 1);
  });

  it.each(['0', '-1', '1.5', 'abc', String(Number.MAX_SAFE_INTEGER + 2)])(
    'una PK BIGINT rechaza %s',
    (valor) => {
      expect(idBigintEnRutaSchema.safeParse(valor).success).toBe(false);
    },
  );
});
