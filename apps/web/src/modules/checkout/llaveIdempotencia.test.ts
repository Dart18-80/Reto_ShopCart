import { describe, expect, it } from 'vitest';
import { nuevaLlaveDeIdempotencia } from './llaveIdempotencia';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('nuevaLlaveDeIdempotencia (RF-06)', () => {
  it('es un UUID v4, el formato que exige el contrato', () => {
    expect(nuevaLlaveDeIdempotencia()).toMatch(UUID_V4);
  });

  it('cada llamada da una llave distinta', () => {
    const llaves = new Set(Array.from({ length: 100 }, nuevaLlaveDeIdempotencia));

    expect(llaves.size).toBe(100);
  });
});
