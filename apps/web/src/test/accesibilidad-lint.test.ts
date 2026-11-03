import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Decisión del PO (F1-H01): eslint-plugin-jsx-a11y 6.10.2 declara compatibilidad hasta ESLint 9; esta prueba
// demuestra que con ESLint 10 sus reglas sí corren en el lint real del proyecto.

const RAIZ = resolve(import.meta.dirname, '../../../..');
const COMPONENTES = resolve(RAIZ, 'apps/web/src/shared/componentes');
const eslint = new ESLint({ cwd: RAIZ });

async function reglasIncumplidas(codigo: string): Promise<string[]> {
  const ruta = join(COMPONENTES, `PruebaA11y${randomUUID().slice(0, 8)}.tsx`);
  await mkdir(COMPONENTES, { recursive: true });
  await writeFile(ruta, codigo, 'utf8');
  try {
    const [resultado] = await eslint.lintFiles([ruta]);
    return (resultado?.messages ?? []).map((mensaje) => mensaje.ruleId ?? '');
  } finally {
    await rm(ruta, { force: true });
  }
}

const ESPERA_LINT_MS = 60_000;

describe('accesibilidad en el lint (jsx-a11y con ESLint 10)', { timeout: ESPERA_LINT_MS }, () => {
  it('una imagen sin alt hace fallar el lint', async () => {
    const reglas = await reglasIncumplidas(
      'export function Logo() {\n  return <img src="/logo.svg" />;\n}\n',
    );

    expect(reglas).toContain('jsx-a11y/alt-text');
  });

  it('la misma imagen con alt pasa', async () => {
    const reglas = await reglasIncumplidas(
      'export function Logo() {\n  return <img src="/logo.svg" alt="ShopCart" />;\n}\n',
    );

    expect(reglas).toEqual([]);
  });
});
