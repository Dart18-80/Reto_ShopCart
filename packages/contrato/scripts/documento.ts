import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';
import { runnerImport } from 'vite';
import { serializarFoto } from './contrato.ts';

export const RAIZ_CONTRATO = fileURLToPath(new URL('..', import.meta.url));
const RAIZ_REPOSITORIO = fileURLToPath(new URL('../../..', import.meta.url));

export const FOTO = 'openapi.json';
export const TIPOS = 'src/openapi.ts';

// La API importa @shopcart/shared desde su código fuente (01 §12), igual que en sus pruebas.
const CONDICION_FUENTE = '@shopcart/fuente';
const ENCABEZADO_TIPOS =
  '// Generado por `pnpm openapi:exportar` desde openapi.json (FE-13). No se edita a mano.\n\n';

interface EntradaApi {
  generarDocumentoOpenApi: () => unknown;
}

// El módulo runner de Vite ejecuta el TypeScript de la API (imports `.js` que apuntan a `.ts`) sin compilarla.
async function documentoDeLaApi(): Promise<unknown> {
  const { module } = await runnerImport<EntradaApi>(
    fileURLToPath(new URL('./entrada-api.ts', import.meta.url)),
    {
      root: RAIZ_REPOSITORIO,
      configFile: false,
      logLevel: 'error',
      resolve: { conditions: [CONDICION_FUENTE] },
      ssr: { resolve: { conditions: [CONDICION_FUENTE] } },
    },
  );
  return module.generarDocumentoOpenApi();
}

/** La foto y sus tipos tal como deben quedar en disco, por ruta relativa a packages/contrato. */
export async function generarArchivos(): Promise<Record<string, string>> {
  const foto = serializarFoto(await documentoDeLaApi());
  const tipos = ENCABEZADO_TIPOS + astToString(await openapiTS(foto));
  return { [FOTO]: foto, [TIPOS]: tipos };
}

export async function leerSiExiste(archivo: string): Promise<string | undefined> {
  try {
    return await readFile(join(RAIZ_CONTRATO, archivo), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}
