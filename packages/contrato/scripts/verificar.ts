// pnpm openapi:verificar (FE-13, corre dentro de pnpm lint): la foto versionada coincide con lo que genera el
// código de la API. Un cambio de contrato sin reexportar falla aquí y no llega al commit sin su diff.
import { diferenciasDeFoto } from './contrato.ts';
import { generarArchivos, leerSiExiste } from './documento.ts';

const generados = await generarArchivos();
const guardados = Object.fromEntries(
  await Promise.all(
    Object.keys(generados).map(async (archivo) => [archivo, await leerSiExiste(archivo)] as const),
  ),
);
const diferencias = diferenciasDeFoto(generados, guardados);

if (diferencias.length > 0) {
  process.stderr.write(
    `La foto del contrato no coincide con el código de la API en: ${diferencias.join(', ')}.\n` +
      'Ejecuta `pnpm openapi:exportar` y agrega el diff al mismo commit (FE-13).\n',
  );
  process.exitCode = 1;
} else {
  process.stdout.write('La foto del contrato coincide con el código de la API.\n');
}
