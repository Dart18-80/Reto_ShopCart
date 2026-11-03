// pnpm openapi:exportar (FE-13): regenera la foto del contrato y sus tipos desde el código de la API.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { generarArchivos, RAIZ_CONTRATO } from './documento.ts';

const archivos = await generarArchivos();
for (const [archivo, contenido] of Object.entries(archivos)) {
  const ruta = join(RAIZ_CONTRATO, archivo);
  await mkdir(dirname(ruta), { recursive: true });
  await writeFile(ruta, contenido, 'utf8');
}
process.stdout.write(`Contrato exportado: ${Object.keys(archivos).join(', ')}\n`);
