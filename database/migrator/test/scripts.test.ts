import { describe, expect, it } from 'vitest';
import { calcularChecksum, dividirEnLotes, normalizar } from '../src/scripts.ts';

const BOM = String.fromCharCode(0xfeff);
const SCRIPT_LF = 'CREATE TABLE dbo.Uno (ID INT);\nGO\n';

describe('normalizar y calcularChecksum', () => {
  it('un script con CRLF tiene el mismo checksum que con LF', () => {
    const conCrlf = SCRIPT_LF.replace(/\n/g, '\r\n');

    expect(calcularChecksum(conCrlf).equals(calcularChecksum(SCRIPT_LF))).toBe(true);
  });

  it('un script con BOM tiene el mismo checksum que sin BOM', () => {
    expect(calcularChecksum(BOM + SCRIPT_LF).equals(calcularChecksum(SCRIPT_LF))).toBe(true);
  });

  it('cualquier cambio de contenido, aunque sea un espacio, cambia el checksum', () => {
    const conEspacio = SCRIPT_LF.replace('INT', 'INT ');

    expect(calcularChecksum(conEspacio).equals(calcularChecksum(SCRIPT_LF))).toBe(false);
  });

  it('el checksum es SHA-256: 32 bytes', () => {
    expect(calcularChecksum(SCRIPT_LF)).toHaveLength(32);
  });

  it('normalizar quita el BOM y convierte CRLF en LF', () => {
    expect(normalizar(`${BOM}A\r\nB\r\n`)).toBe('A\nB\n');
  });
});

describe('dividirEnLotes', () => {
  it('separa los lotes por GO en su propia línea', () => {
    const lotes = dividirEnLotes('SELECT 1;\nGO\nSELECT 2;\ngo\nSELECT 3;');

    expect(lotes).toEqual(['SELECT 1;', 'SELECT 2;', 'SELECT 3;']);
  });

  it('acepta un comentario después de GO', () => {
    expect(dividirEnLotes('SELECT 1;\nGO -- fin del lote\nSELECT 2;')).toEqual([
      'SELECT 1;',
      'SELECT 2;',
    ]);
  });

  it('no corta en una palabra que contiene GO', () => {
    expect(dividirEnLotes("SELECT N'GOOGLE' AS Nombre;")).toEqual(["SELECT N'GOOGLE' AS Nombre;"]);
  });

  it('descarta los lotes vacíos', () => {
    expect(dividirEnLotes('GO\n\nGO\nSELECT 1;\nGO\n')).toEqual(['SELECT 1;']);
  });

  it('no corta en un GO que está dentro de un comentario de bloque', () => {
    const script = '/* Ejemplo de uso:\nGO\n*/\nSELECT 1;';

    expect(dividirEnLotes(script)).toEqual([script]);
  });

  it('respeta comentarios de bloque anidados, como T-SQL', () => {
    const script = '/* externo /* interno */\nGO\n*/\nSELECT 1;';

    expect(dividirEnLotes(script)).toEqual([script]);
  });

  it('no corta en un GO que está dentro de una cadena de varias líneas', () => {
    const script = "SELECT N'primera línea\nGO\núltima línea';";

    expect(dividirEnLotes(script)).toEqual([script]);
  });

  it('una comilla escapada no cierra la cadena', () => {
    const script = "SELECT N'it''s\nGO\nfin';";

    expect(dividirEnLotes(script)).toEqual([script]);
  });

  it('una comilla dentro de un comentario de línea no abre una cadena', () => {
    expect(dividirEnLotes("SELECT 1; -- it's\nGO\nSELECT 2;")).toEqual([
      "SELECT 1; -- it's",
      'SELECT 2;',
    ]);
  });

  it('corta en el GO que sigue a un comentario de bloque ya cerrado', () => {
    expect(dividirEnLotes('/* nota */\nSELECT 1;\nGO\nSELECT 2;')).toEqual([
      '/* nota */\nSELECT 1;',
      'SELECT 2;',
    ]);
  });

  it('tilde y Unicode no alteran el corte', () => {
    expect(dividirEnLotes("SELECT N'Camión ñandú 🚚';\nGO\nSELECT N'Sololá';")).toEqual([
      "SELECT N'Camión ñandú 🚚';",
      "SELECT N'Sololá';",
    ]);
  });
});
