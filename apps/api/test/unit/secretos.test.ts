import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RAIZ = resolve(import.meta.dirname, '../../../..');
const SECRETO = /CONTRASENA|PASSWORD|SECRET|TOKEN|CLAVE/;
// Misma marca que rechaza cargarConfiguracion en producción (§10).
const MARCA_EJEMPLO = 'EJEMPLO';

function lineasDe(archivo: string): string[] {
  return readFileSync(resolve(RAIZ, archivo), 'utf8').split(/\r?\n/);
}

describe('ninguna credencial real en el repositorio (E0-H02)', () => {
  it('todo secreto de .env.example está marcado como ejemplo', () => {
    const secretos = lineasDe('.env.example')
      .filter((linea) => !linea.startsWith('#') && linea.includes('='))
      .map((linea) => linea.split('=', 2) as [string, string])
      .filter(([nombre]) => SECRETO.test(nombre));

    expect(secretos.length).toBeGreaterThan(0);
    for (const [nombre, valor] of secretos) {
      expect(valor, nombre).toContain(MARCA_EJEMPLO);
    }
  });

  it('.env (con las credenciales reales) está en .gitignore', () => {
    expect(lineasDe('.gitignore')).toContain('.env');
  });
});
