import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ESLint } from 'eslint';

const REPOSITORIO = resolve(import.meta.dirname, '../../../..');
const CONFIGURACION = join(REPOSITORIO, 'eslint.config.mjs');
const TSCONFIG_WEB = 'apps/web/tsconfig.json';

export interface ProyectoDeLint {
  /** Escribe un archivo relativo a apps/web/src del proyecto temporal. */
  escribir: (ruta: string, contenido: string) => Promise<void>;
  /** Corre el lint real sobre ese archivo y devuelve los mensajes de las reglas elegidas. */
  mensajes: (ruta: string) => Promise<{ ruleId: string | null; message: string }[]>;
  borrar: () => Promise<void>;
}

/**
 * Un proyecto temporal en os.tmpdir() con la misma estructura que apps/web/src, lintado con el eslint.config.mjs
 * real: las reglas clasifican los archivos por su ruta, y así las pruebas nunca escriben dentro de src/. Solo
 * corren las reglas elegidas, sin el programa de TypeScript (ninguna de ellas usa tipos).
 */
export async function crearProyectoDeLint(
  reglaElegida: (ruleId: string) => boolean,
): Promise<ProyectoDeLint> {
  const raiz = await mkdtemp(join(tmpdir(), 'shopcart-lint-'));
  const tsconfig = join(raiz, TSCONFIG_WEB);
  await mkdir(dirname(tsconfig), { recursive: true });
  await writeFile(tsconfig, JSON.stringify({ include: ['src'] }), 'utf8');

  const eslint = new ESLint({
    cwd: raiz,
    overrideConfigFile: CONFIGURACION,
    ruleFilter: ({ ruleId }) => reglaElegida(ruleId),
    overrideConfig: [
      { files: ['**/*.{ts,tsx}'], languageOptions: { parserOptions: { projectService: false } } },
      {
        files: ['apps/web/src/**/*.{ts,tsx}'],
        settings: {
          'boundaries/root-path': raiz,
          'import/resolver': { typescript: { project: tsconfig } },
        },
      },
    ],
  });
  const enSrc = (ruta: string) => join(raiz, 'apps/web/src', ruta);

  return {
    async escribir(ruta, contenido) {
      await mkdir(dirname(enSrc(ruta)), { recursive: true });
      await writeFile(enSrc(ruta), contenido, 'utf8');
    },
    async mensajes(ruta) {
      const [resultado] = await eslint.lintFiles([enSrc(ruta)]);
      return (resultado?.messages ?? []).map(({ ruleId, message }) => ({ ruleId, message }));
    },
    borrar: () => rm(raiz, { recursive: true, force: true }),
  };
}
