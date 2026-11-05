import { describe, expect, it } from 'vitest';
import { plazoDeEntrega } from './plazoDeEntrega';

describe('plazoDeEntrega', () => {
  it('un rango de días', () => {
    expect(plazoDeEntrega(3, 5)).toBe('Llega en 3 a 5 días hábiles.');
  });

  it('un solo día va en singular', () => {
    expect(plazoDeEntrega(1, 1)).toBe('Llega en 1 día hábil.');
  });

  it('varios días iguales van en plural', () => {
    expect(plazoDeEntrega(2, 2)).toBe('Llega en 2 días hábiles.');
  });
});
