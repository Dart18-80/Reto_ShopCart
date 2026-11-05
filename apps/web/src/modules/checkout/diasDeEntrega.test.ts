import { describe, expect, it } from 'vitest';
import { diasDeEntrega } from './diasDeEntrega';

describe('diasDeEntrega', () => {
  it('un rango de días', () => {
    expect(diasDeEntrega(3, 5)).toBe('3 a 5 días hábiles');
  });

  it('un solo día va en singular', () => {
    expect(diasDeEntrega(1, 1)).toBe('1 día hábil');
  });

  it('varios días iguales van en plural', () => {
    expect(diasDeEntrega(2, 2)).toBe('2 días hábiles');
  });
});
