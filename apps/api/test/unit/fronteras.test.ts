import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const RAIZ = resolve(import.meta.dirname, '../../../..');
const MODULOS = resolve(RAIZ, 'apps/api/src/modules');
const REGLA = 'boundaries/dependencies';

const PREFIJO_TEMPORAL = 'prueba-';

const eslint = new ESLint({ cwd: RAIZ });

// Si una corrida anterior se interrumpió, su módulo temporal seguiría en src y ensuciaría tsc y el lint.
beforeAll(async () => {
  const sobrantes = (await readdir(MODULOS)).filter((nombre) =>
    nombre.startsWith(PREFIJO_TEMPORAL),
  );
  await Promise.all(
    sobrantes.map((nombre) => rm(join(MODULOS, nombre), { recursive: true, force: true })),
  );
});

/**
 * Lint real del proyecto sobre un módulo temporal: la regla necesita un archivo de verdad dentro de
 * src/modules para clasificarlo. La carpeta se borra siempre, aunque la prueba falle.
 */
async function erroresDeFrontera(codigo: string): Promise<string[]> {
  const carpeta = join(MODULOS, `${PREFIJO_TEMPORAL}${randomUUID().slice(0, 8)}`);
  const archivo = join(carpeta, 'prueba.service.ts');
  await mkdir(carpeta);
  try {
    await writeFile(archivo, codigo, 'utf8');
    const [resultado] = await eslint.lintFiles([archivo]);
    return (resultado?.messages ?? [])
      .filter((mensaje) => mensaje.ruleId === REGLA)
      .map((mensaje) => mensaje.message);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

// El lint con información de tipos carga el programa de TypeScript: tarda varios segundos, más con carga.
const ESPERA_LINT_MS = 60_000;

describe('fronteras entre módulos (E0-H01, A-01)', { timeout: ESPERA_LINT_MS }, () => {
  it('importar el repositorio de otro módulo hace fallar el lint', async () => {
    const errores = await erroresDeFrontera(
      "import { sistemaRepository } from '../sistema/sistema.repository.js';\n\nexport const repositorio = sistemaRepository;\n",
    );

    expect(errores).toEqual([expect.stringContaining('A-01') as unknown]);
  });

  it('importar el index.ts de otro módulo está permitido', async () => {
    const errores = await erroresDeFrontera(
      "import { crearModuloSistema } from '../sistema/index.js';\n\nexport const crear = crearModuloSistema;\n",
    );

    expect(errores).toEqual([]);
  });
});
