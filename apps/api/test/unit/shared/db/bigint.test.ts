import { describe, expect, it } from 'vitest';
import { bigintANumero } from '../../../../src/shared/db/index.js';

describe('bigintANumero', () => {
  it('convierte un BIGINT que llega como texto, hasta el mayor entero seguro', () => {
    expect(bigintANumero('42', 'IDMovimientoKardex')).toBe(42);
    expect(bigintANumero(String(Number.MAX_SAFE_INTEGER), 'IDMovimientoKardex')).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });

  it('falla en voz alta si perdería precisión o no es un entero', () => {
    expect(() => bigintANumero('9007199254740993', 'IDMovimientoKardex')).toThrow(
      /IDMovimientoKardex/,
    );
    expect(() => bigintANumero('1.5', 'IDMovimientoKardex')).toThrow();
  });
});
