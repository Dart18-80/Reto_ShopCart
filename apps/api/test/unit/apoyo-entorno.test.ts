import { describe, expect, it } from 'vitest';
import { ejecutarConPlazo, esperar } from '../entorno/apoyo-entorno.js';

// Un `docker` colgado (el daemon no responde) no puede dejar a las pruebas del entorno esperando para siempre.
describe('apoyo de las pruebas del entorno', () => {
  it('un comando que no responde se corta al vencer su plazo', async () => {
    const inicio = Date.now();

    await expect(
      ejecutarConPlazo(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], 300),
    ).rejects.toThrow();
    expect(Date.now() - inicio).toBeLessThan(5_000);
  });

  it('esperar se rinde tras su número máximo de intentos, aunque la condición nunca falle', async () => {
    let intentos = 0;

    await expect(
      esperar(
        () => {
          intentos++;
          return Promise.resolve(false);
        },
        'nunca',
        { intentos: 3, intervaloMs: 10 },
      ),
    ).rejects.toThrow('No se cumplió a tiempo: nunca');
    expect(intentos).toBe(3);
  });
});
