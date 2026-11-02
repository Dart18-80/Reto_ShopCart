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

/** Las capas del módulo temporal: cada una exporta algo que las demás pueden importar. */
const CAPAS = {
  'prueba.routes.ts': 'export const rutas = 1;\n',
  'prueba.controller.ts': 'export const controlador = 1;\n',
  'prueba.service.ts': 'export const servicio = 1;\n',
  'prueba.repository.ts': 'export const repositorio = 1;\n',
};

/**
 * Lint real del proyecto sobre un módulo temporal: la regla necesita archivos de verdad dentro de src/modules
 * para clasificarlos. `archivo` reemplaza a su capa con `codigo`. La carpeta se borra siempre, aunque la prueba
 * falle.
 */
async function erroresDeFrontera(codigo: string, archivo = 'prueba.service.ts'): Promise<string[]> {
  const carpeta = join(MODULOS, `${PREFIJO_TEMPORAL}${randomUUID().slice(0, 8)}`);
  await mkdir(carpeta);
  try {
    for (const [nombre, contenido] of Object.entries(CAPAS)) {
      await writeFile(join(carpeta, nombre), nombre === archivo ? codigo : contenido, 'utf8');
    }
    const [resultado] = await eslint.lintFiles([join(carpeta, archivo)]);
    return (resultado?.messages ?? [])
      .filter((mensaje) => mensaje.ruleId === REGLA)
      .map((mensaje) => mensaje.message);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
}

const importar = (nombre: string, ruta: string) =>
  `import { ${nombre} } from '${ruta}';\n\nexport const usado = ${nombre};\n`;

// El lint con información de tipos carga el programa de TypeScript: tarda varios segundos, más con carga.
const ESPERA_LINT_MS = 60_000;

describe('fronteras entre módulos (E0-H01, A-01)', { timeout: ESPERA_LINT_MS }, () => {
  it('importar el repositorio de otro módulo hace fallar el lint', async () => {
    const errores = await erroresDeFrontera(
      importar('sistemaRepository', '../sistema/sistema.repository.js'),
    );

    expect(errores).toEqual([expect.stringContaining('A-01') as unknown]);
  });

  it('importar el index.ts de otro módulo está permitido', async () => {
    const errores = await erroresDeFrontera(importar('crearModuloSistema', '../sistema/index.js'));

    expect(errores).toEqual([]);
  });
});

describe(
  'orden de capas dentro de un módulo (decisión del PO en E9, A-01)',
  { timeout: ESPERA_LINT_MS },
  () => {
    it.each([
      [
        'el controlador importa el repositorio',
        'prueba.controller.ts',
        'repositorio',
        './prueba.repository.js',
      ],
      ['el servicio importa Express', 'prueba.service.ts', 'Router', 'express'],
      ['el servicio importa las rutas', 'prueba.service.ts', 'rutas', './prueba.routes.js'],
      [
        'el servicio importa el controlador',
        'prueba.service.ts',
        'controlador',
        './prueba.controller.js',
      ],
      [
        'el repositorio importa el servicio',
        'prueba.repository.ts',
        'servicio',
        './prueba.service.js',
      ],
    ])('%s: el lint falla', async (_caso, archivo, nombre, ruta) => {
      const errores = await erroresDeFrontera(importar(nombre, ruta), archivo);

      expect(errores).toEqual([expect.stringContaining('capas') as unknown]);
    });

    it.each([
      [
        'el controlador importa el servicio',
        'prueba.controller.ts',
        'servicio',
        './prueba.service.js',
      ],
      [
        'el servicio importa el repositorio',
        'prueba.service.ts',
        'repositorio',
        './prueba.repository.js',
      ],
      [
        'las rutas importan el controlador',
        'prueba.routes.ts',
        'controlador',
        './prueba.controller.js',
      ],
    ])('%s: permitido', async (_caso, archivo, nombre, ruta) => {
      const errores = await erroresDeFrontera(importar(nombre, ruta), archivo);

      expect(errores).toEqual([]);
    });
  },
);
