import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface EntradaManifest {
  file: string;
  isEntry?: boolean;
  imports?: string[];
}

const RAIZ_WEB = resolve(import.meta.dirname, '../..');
// Textos que solo existen en el layout y las páginas del backoffice. Las etiquetas del menú no sirven: la definición
// de rutas (FE-04) va en el paquete principal porque de ella salen el guardián y los menús.
const SOLO_BACKOFFICE = ['Secciones del backoffice', 'Gestión de pedidos', 'Gestión del catálogo'];
const CONSTRUCCION_MS = 120_000;

let salida = '';
let manifest: Record<string, EntradaManifest> = {};

const contenido = (archivo: string) => readFile(join(salida, archivo), 'utf8');

/** El paquete de entrada y todo lo que importa de forma estática: lo que descarga cualquier visitante. */
function paqueteInicial(): string[] {
  const entrada = Object.entries(manifest).find(([, e]) => e.isEntry);
  if (!entrada) throw new Error('El manifest no tiene entrada.');
  const visitados = new Set<string>();
  const pendientes = [entrada[0]];
  while (pendientes.length > 0) {
    const clave = pendientes.pop() ?? '';
    if (visitados.has(clave)) continue;
    visitados.add(clave);
    pendientes.push(...(manifest[clave]?.imports ?? []));
  }
  return [...visitados].map((clave) => manifest[clave]?.file ?? '');
}

beforeAll(async () => {
  salida = await mkdtemp(join(tmpdir(), 'shopcart-web-'));
  await build({
    root: RAIZ_WEB,
    // Vitest fija NODE_ENV=test; los paquetes que importan son los de producción.
    mode: 'production',
    configFile: join(RAIZ_WEB, 'vite.config.ts'),
    logLevel: 'silent',
    build: { outDir: salida, emptyOutDir: true, manifest: 'manifest.json' },
  });
  manifest = JSON.parse(await contenido('manifest.json')) as Record<string, EntradaManifest>;
}, CONSTRUCCION_MS);

afterAll(async () => {
  await rm(salida, { recursive: true, force: true });
});

describe('paquetes del build (F1-H05)', () => {
  it('el código del backoffice no está en lo que descarga cualquier visitante', async () => {
    for (const archivo of paqueteInicial()) {
      const codigo = await contenido(archivo);
      for (const texto of SOLO_BACKOFFICE) {
        expect(codigo.includes(texto), `«${texto}» está en ${archivo}`).toBe(false);
      }
    }
  });

  it('el layout del backoffice y cada una de sus páginas tienen su propio paquete', () => {
    const archivos = Object.values(manifest).map((e) => e.file);

    expect(archivos.some((f) => /LayoutBackoffice-.*\.js$/.test(f))).toBe(true);
    expect(archivos.some((f) => /GestionPedidosPagina-.*\.js$/.test(f))).toBe(true);
    expect(archivos.some((f) => /BitacoraPagina-.*\.js$/.test(f))).toBe(true);
  });
});
