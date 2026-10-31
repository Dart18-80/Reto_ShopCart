import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ErrorMigracion } from '../src/errores.ts';
import { BASE_PRUEBAS } from '../src/conexion.ts';
import { carpetasPara, leerScripts } from '../src/scripts.ts';

const CARPETAS = carpetasPara('ShopCart');
const BOM = String.fromCharCode(0xfeff);

let directorio: string;

beforeEach(async () => {
  directorio = await mkdtemp(join(tmpdir(), 'migrador-'));
  for (const carpeta of ['migrations', 'programmability', 'seeds']) {
    await mkdir(join(directorio, carpeta));
  }
});

afterEach(async () => {
  await rm(directorio, { recursive: true, force: true });
});

function escribir(ruta: string, contenido = 'SELECT 1;') {
  return writeFile(join(directorio, ruta), contenido, 'utf8');
}

const nombres = (scripts: { nombre: string }[]) => scripts.map((script) => script.nombre);

describe('leerScripts', () => {
  it('con las carpetas vacías no hay nada que aplicar', async () => {
    expect(await leerScripts(directorio, CARPETAS)).toEqual([]);
  });

  it('devuelve V → R → S, cada carpeta en orden alfabético', async () => {
    await escribir('seeds/S001__datos.sql');
    await escribir('programmability/R__SP_Modulo_Proceso.sql');
    await escribir('migrations/V002__dos.sql');
    await escribir('migrations/V001__uno.sql');

    expect(nombres(await leerScripts(directorio, CARPETAS))).toEqual([
      'V001__uno.sql',
      'V002__dos.sql',
      'R__SP_Modulo_Proceso.sql',
      'S001__datos.sql',
    ]);
  });

  it('acepta huecos en la numeración (V001, V003)', async () => {
    await escribir('migrations/V001__uno.sql');
    await escribir('migrations/V003__tres.sql');

    expect(nombres(await leerScripts(directorio, CARPETAS))).toEqual([
      'V001__uno.sql',
      'V003__tres.sql',
    ]);
  });

  it('rechaza dos scripts con el mismo número de versión', async () => {
    await escribir('migrations/V001__uno.sql');
    await escribir('migrations/V001__otro.sql');

    await expect(leerScripts(directorio, CARPETAS)).rejects.toThrow(/Versión 001 repetida/);
  });

  it('rechaza un archivo .sql con un nombre fuera de la convención', async () => {
    await escribir('migrations/V1__sin_ceros.sql');

    await expect(leerScripts(directorio, CARPETAS)).rejects.toBeInstanceOf(ErrorMigracion);
  });

  it('rechaza un R__ que no es FU, VW, SP ni TR', async () => {
    await escribir('programmability/R__XX_Modulo_Proceso.sql');

    await expect(leerScripts(directorio, CARPETAS)).rejects.toThrow(/Nombres inválidos/);
  });

  it('ignora los archivos que no son .sql (por ejemplo, .gitkeep)', async () => {
    await escribir('seeds/.gitkeep', '');

    expect(await leerScripts(directorio, CARPETAS)).toEqual([]);
  });

  it('lee un archivo con BOM y CRLF con el mismo checksum y los mismos lotes que con LF', async () => {
    await escribir('migrations/V001__lf.sql', 'SELECT 1;\nGO\nSELECT 2;\n');
    await escribir('migrations/V002__crlf.sql', `${BOM}SELECT 1;\r\nGO\r\nSELECT 2;\r\n`);

    const [lf, crlf] = await leerScripts(directorio, CARPETAS);

    expect(crlf?.checksum.equals(lf?.checksum ?? Buffer.alloc(0))).toBe(true);
    expect(crlf?.lotes).toEqual(['SELECT 1;', 'SELECT 2;']);
  });

  it('lee el encabezado -- depende-de: aunque el archivo tenga BOM y CRLF', async () => {
    await escribir(
      'programmability/R__SP_A_Uno.sql',
      `${BOM}-- depende-de: R__SP_B_Dos.sql\r\nSELECT 1;`,
    );
    await escribir('programmability/R__SP_B_Dos.sql');

    expect(nombres(await leerScripts(directorio, CARPETAS))).toEqual([
      'R__SP_B_Dos.sql',
      'R__SP_A_Uno.sql',
    ]);
  });

  it('falla con un mensaje claro si un R__ depende de sí mismo', async () => {
    await escribir('programmability/R__SP_A_Uno.sql', '-- depende-de: R__SP_A_Uno.sql\nSELECT 1;');

    await expect(leerScripts(directorio, CARPETAS)).rejects.toThrow(/Dependencia circular/);
  });

  it('una carpeta que no existe cuenta como vacía: git no versiona carpetas vacías', async () => {
    await rm(join(directorio, 'seeds'), { recursive: true });
    await escribir('migrations/V001__uno.sql');

    expect(nombres(await leerScripts(directorio, CARPETAS))).toEqual(['V001__uno.sql']);
  });

  it('falla si falta migrations/: el directorio de scripts apunta a otro lado', async () => {
    await rm(join(directorio, 'migrations'), { recursive: true });

    await expect(leerScripts(directorio, CARPETAS)).rejects.toThrow(
      /Falta la carpeta migrations\//,
    );
  });

  it('nunca incluye database/test/ (SPs de prueba) al migrar la base real', async () => {
    await mkdir(join(directorio, 'test'));
    await escribir('test/R__SP_Pruebas_Saltar.sql');
    await escribir('migrations/V001__uno.sql');

    expect(nombres(await leerScripts(directorio, carpetasPara('ShopCart')))).toEqual([
      'V001__uno.sql',
    ]);
  });

  it('en shopcart_test incluye database/test/ al final, después de las semillas', async () => {
    await mkdir(join(directorio, 'test'));
    await escribir('test/R__SP_Pruebas_Saltar.sql');
    await escribir('seeds/S001__datos.sql');
    await escribir('migrations/V001__uno.sql');

    expect(nombres(await leerScripts(directorio, carpetasPara(BASE_PRUEBAS)))).toEqual([
      'V001__uno.sql',
      'S001__datos.sql',
      'R__SP_Pruebas_Saltar.sql',
    ]);
  });

  it('si no existe el directorio de scripts falla en lugar de reportar "nada que aplicar"', async () => {
    const inexistente = join(directorio, 'no-existe');

    await expect(leerScripts(inexistente, CARPETAS)).rejects.toThrow(
      /No existe el directorio de scripts/,
    );
  });
});
