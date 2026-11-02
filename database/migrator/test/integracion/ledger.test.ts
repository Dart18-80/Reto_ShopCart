import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pino } from 'pino';
import { beforeAll, describe, expect, it } from 'vitest';
import { leerConfiguracion } from '../../src/config.ts';
import { ErrorLedger, verificarLedger } from '../../src/ledger.ts';
import { migrar } from '../../src/migrador.ts';

// M-01: las tablas ledger se verifican contra digests guardados fuera de la base. shopcart_test se migra con los
// scripts reales: las semillas ya escriben en el kardex y la bitácora.

const silencioso = pino({ level: 'silent' });
const config = { ...leerConfiguracion(process.env, ['--pruebas']) };

beforeAll(async () => {
  await migrar(config, silencioso);
}, 300_000);

async function digestsGuardados(
  directorio: string,
): Promise<{ archivo: string; lineas: string[] }> {
  const [nombre] = await readdir(directorio);
  if (nombre === undefined) throw new Error('No se guardó ningún digest');
  const archivo = join(directorio, nombre);
  return { archivo, lineas: (await readFile(archivo, 'utf8')).trim().split('\n') };
}

describe('pnpm ledger:verificar (M-01)', () => {
  it('genera el digest, lo guarda fuera de la base y verifica el ledger contra todos los guardados', async () => {
    const directorio = await mkdtemp(join(tmpdir(), 'ledger-'));

    const primera = await verificarLedger(config, directorio, silencioso);
    const segunda = await verificarLedger(config, directorio, silencioso);

    const { archivo, lineas } = await digestsGuardados(directorio);
    expect([primera.digests, segunda.digests]).toEqual([1, 2]);
    expect(archivo).toContain('shopcart_test');
    expect(JSON.parse(lineas[0] ?? '{}')).toMatchObject({
      database_name: 'shopcart_test',
      hash: expect.stringMatching(/^0x[0-9A-F]+$/i) as unknown,
    });
  });

  it('si un digest guardado no corresponde a la base, la verificación falla', async () => {
    const directorio = await mkdtemp(join(tmpdir(), 'ledger-'));
    await verificarLedger(config, directorio, silencioso);
    const { archivo, lineas } = await digestsGuardados(directorio);
    const digest = JSON.parse(lineas[0] ?? '{}') as { hash: string };
    const alterado = { ...digest, hash: `0x${'0'.repeat(digest.hash.length - 2)}` };
    await writeFile(archivo, `${JSON.stringify(alterado)}\n`);

    await expect(verificarLedger(config, directorio, silencioso)).rejects.toBeInstanceOf(
      ErrorLedger,
    );
  });
});
