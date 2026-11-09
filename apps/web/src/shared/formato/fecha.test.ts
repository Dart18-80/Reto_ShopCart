import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aEntradaLocal,
  deEntradaLocal,
  formatearDia,
  formatearDiaYMes,
  formatearFechaCalendario,
  formatearFechaHora,
} from './fecha';

// 23:30 del 3 de noviembre en Guatemala (UTC-6) es 05:30 del 4 de noviembre en UTC.
const MEDIA_NOCHE_DE_GUATEMALA_EN_UTC = '2026-11-04T05:30:00.000Z';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(MEDIA_NOCHE_DE_GUATEMALA_EN_UTC));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('formatearFechaHora (FE-10)', () => {
  it('a las 23:30 de Guatemala (otro día en UTC) muestra el día y la hora de Guatemala', () => {
    expect(formatearFechaHora(new Date().toISOString())).toBe('3 nov 2026, 23:30');
  });

  it('usa el formato de Figma («3 nov 2026, 10:42») en 24 horas', () => {
    expect(formatearFechaHora('2026-11-03T16:42:00.000Z')).toBe('3 nov 2026, 10:42');
  });

  it('un texto que no es una fecha es un error del programa', () => {
    expect(() => formatearFechaHora('ayer')).toThrow(/no es una fecha/);
  });
});

describe('formatearFechaCalendario (FE-10)', () => {
  it('«2026-11-03» es el 3 de noviembre, aunque en UTC ya sea el 4', () => {
    expect(formatearFechaCalendario('2026-11-03')).toBe('3 nov 2026');
  });

  it('no convierte la fecha a un instante: nunca construye un Date', () => {
    const constructor = vi.spyOn(globalThis, 'Date');

    formatearFechaCalendario('2026-01-01');

    expect(constructor).not.toHaveBeenCalled();
  });

  it('cada mes se abrevia igual que en formatearFechaHora', () => {
    for (let mes = 1; mes <= 12; mes++) {
      const dosDigitos = String(mes).padStart(2, '0');
      const mediodiaEnGuatemala = `2026-${dosDigitos}-15T18:00:00.000Z`;
      const [fecha] = formatearFechaHora(mediodiaEnGuatemala).split(',');

      expect(formatearFechaCalendario(`2026-${dosDigitos}-15`)).toBe(fecha);
    }
  });

  it('un texto que no es AAAA-MM-DD es un error del programa', () => {
    expect(() => formatearFechaCalendario('03/11/2026')).toThrow(/AAAA-MM-DD/);
    expect(() => formatearFechaCalendario('2026-13-01')).toThrow(/AAAA-MM-DD/);
  });
});

describe('formatearDiaYMes (FE-10)', () => {
  it('un instante en la noche de Guatemala (ya otro día en UTC) es el día de Guatemala, con el mes completo', () => {
    expect(formatearDiaYMes('2026-11-09T05:30:00.000Z')).toBe('8 de noviembre');
  });

  it('un texto que no es una fecha con zona es un error del programa', () => {
    expect(() => formatearDiaYMes('2026-11-08')).toThrow();
  });
});

describe('formatearDia (FE-10)', () => {
  it('el día de Guatemala de un instante, sin hora: el de la noche ya es otro día en UTC', () => {
    expect(formatearDia(MEDIA_NOCHE_DE_GUATEMALA_EN_UTC)).toBe('3 nov 2026');
  });
});

describe('fecha y hora de un formulario en la hora de Guatemala (M9-H01, A-12)', () => {
  it('un instante de la noche de Guatemala (otro día en UTC) se escribe con el día y la hora de Guatemala', () => {
    expect(aEntradaLocal('2026-11-04T05:30:00.000Z')).toBe('2026-11-03T23:30');
  });

  it('lo escrito se lee como hora de Guatemala: el mismo instante con su zona', () => {
    const instante = deEntradaLocal('2026-11-03T23:30');

    expect(instante).toBe('2026-11-03T23:30:00-06:00');
    expect(new Date(instante).toISOString()).toBe('2026-11-04T05:30:00.000Z');
  });

  it('ida y vuelta conserva el instante', () => {
    expect(new Date(deEntradaLocal(aEntradaLocal('2026-02-28T12:15:00.000Z'))).toISOString()).toBe(
      '2026-02-28T12:15:00.000Z',
    );
  });

  it('un texto que no es AAAA-MM-DDTHH:mm es un error del programa', () => {
    expect(() => deEntradaLocal('2026-11-03')).toThrow(/AAAA-MM-DDTHH:mm/);
  });
});
