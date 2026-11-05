import { describe, expect, it } from 'vitest';
import { formatearRestante, restanteHasta } from './cuentaRegresiva';

describe('cuenta regresiva de la reserva', () => {
  it('lo que falta para expiraEn', () => {
    expect(restanteHasta('2026-11-05T18:15:00.000Z', Date.parse('2026-11-05T18:00:28.000Z'))).toBe(
      872_000,
    );
  });

  it('pasada la hora no es negativo', () => {
    expect(restanteHasta('2026-11-05T18:15:00.000Z', Date.parse('2026-11-05T18:16:00.000Z'))).toBe(
      0,
    );
  });

  it.each([
    [872_000, '14:32'],
    [65_500, '01:06'],
    [999, '00:01'],
    [0, '00:00'],
  ])('%i ms se muestran como %s', (ms, texto) => {
    expect(formatearRestante(ms)).toBe(texto);
  });
});
