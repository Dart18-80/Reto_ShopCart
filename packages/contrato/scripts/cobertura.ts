// pnpm contrato:cobertura (FE-13): cada ruta de la foto, cubierta por un *.api.ts de la web, excluida con su
// motivo o pendiente. Con --estricto (cierre de F6) termina con error si queda alguna pendiente.
import { glob, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calcularCobertura,
  operacionesDelDocumento,
  rutasUsadas,
  type DocumentoOpenApi,
  type EstadoRuta,
  type Exclusion,
} from './contrato.ts';
import { FOTO, RAIZ_CONTRATO } from './documento.ts';

// Los *.api.ts de los módulos y el de la sesión (shared/api/sesion/sesion.api.ts: refresh y logout, F1-H04).
const FUENTES_WEB = fileURLToPath(new URL('../../../apps/web/src', import.meta.url));
const ESTRICTO = process.argv.includes('--estricto');

const leerJson = async <T>(archivo: string) =>
  JSON.parse(await readFile(join(RAIZ_CONTRATO, archivo), 'utf8')) as T;

async function rutasDeLaWeb() {
  const fuentes = [];
  for await (const archivo of glob('**/*.api.ts', { cwd: FUENTES_WEB })) {
    fuentes.push(await readFile(join(FUENTES_WEB, archivo), 'utf8'));
  }
  return fuentes.flatMap(rutasUsadas);
}

const plural = (n: number, palabra: string) => `${String(n)} ${palabra}${n === 1 ? '' : 's'}`;
const resumen = (cubiertas: number, excluidas: number, pendientes: number) =>
  `${plural(cubiertas, 'cubierta')} · ${plural(excluidas, 'excluida')} · ${plural(pendientes, 'pendiente')}`;
const linea = (r: EstadoRuta) =>
  `  ${r.estado.padEnd(9)}  ${r.metodo.padEnd(6)} ${r.ruta}${r.estado === 'excluida' ? `  (${r.motivo})` : ''}`;

const cobertura = calcularCobertura(
  operacionesDelDocumento(await leerJson<DocumentoOpenApi>(FOTO)),
  await rutasDeLaWeb(),
  await leerJson<Exclusion[]>('exclusiones.json'),
);

const salida = ['Cobertura del contrato (FE-13)', ''];
for (const modulo of [...cobertura.modulos.keys()].sort((a, b) => a.localeCompare(b, 'es'))) {
  const rutas = cobertura.modulos.get(modulo) ?? [];
  const cuenta = (estado: EstadoRuta['estado']) => rutas.filter((r) => r.estado === estado).length;
  salida.push(
    `${modulo} — ${resumen(cuenta('cubierta'), cuenta('excluida'), cuenta('pendiente'))}`,
  );
  salida.push(...rutas.map(linea), '');
}
const total = cobertura.cubiertas + cobertura.excluidas + cobertura.pendientes;
salida.push(
  `Total: ${resumen(cobertura.cubiertas, cobertura.excluidas, cobertura.pendientes)} de ${String(total)}`,
);
process.stdout.write(`${salida.join('\n')}\n`);

if (cobertura.inconsistencias.length > 0) {
  process.stderr.write(`\n${cobertura.inconsistencias.join('\n')}\n`);
  process.exitCode = 1;
} else if (ESTRICTO && cobertura.pendientes > 0) {
  process.stderr.write(
    `\n--estricto: quedan ${plural(cobertura.pendientes, 'ruta')} sin consumir ni justificar.\n`,
  );
  process.exitCode = 1;
}
