import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const ejecutar = promisify(execFile);
const IMAGEN = 'shopcart-api:local';

// Se ejecuta dentro de la imagen, desde su directorio de trabajo: resuelve @shopcart/shared como la API.
const USAR_SHARED = `
import { textoNvarchar } from '@shopcart/shared';
const resultado = textoNvarchar(10).safeParse('  Jose\u0301  ');
console.log(JSON.stringify({ ok: resultado.success, valor: resultado.data }));
`;

// Lista lo que no debe llegar a producción: TypeScript (salvo .d.ts) y carpetas src del proyecto y de
// @shopcart/shared, y el compilador.
const BUSCAR_FUENTES = `
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
function recorrer(directorio, saltarDependencias) {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      if (saltarDependencias && entrada.name === 'node_modules') return [];
      return entrada.name === 'src' ? [ruta] : recorrer(ruta, saltarDependencias);
    }
    return entrada.name.endsWith('.ts') && !entrada.name.endsWith('.d.ts') ? [ruta] : [];
  });
}
const shared = dirname(dirname(fileURLToPath(import.meta.resolve('@shopcart/shared'))));
console.log(JSON.stringify({
  proyecto: recorrer('/app', true),
  shared: recorrer(shared, false),
  compilador: existsSync('/app/node_modules/typescript'),
}));
`;

async function nodeEnLaImagen(codigo: string): Promise<unknown> {
  const { stdout } = await ejecutar('docker', [
    'run',
    '--rm',
    IMAGEN,
    'node',
    '--input-type=module',
    '-e',
    codigo,
  ]);
  return JSON.parse(stdout) as unknown;
}

describe('imagen de la API (prueba de humo)', { timeout: 60_000 }, () => {
  it('importa textoNvarchar desde @shopcart/shared y la ejecuta', async () => {
    expect(await nodeEnLaImagen(USAR_SHARED)).toEqual({ ok: true, valor: 'José' });
  });

  it('solo lleva JavaScript compilado: nada de src/ ni TypeScript, tampoco el compilador', async () => {
    expect(await nodeEnLaImagen(BUSCAR_FUENTES)).toEqual({
      proyecto: [],
      shared: [],
      compilador: false,
    });
  });
});
