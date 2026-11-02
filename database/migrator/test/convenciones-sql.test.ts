import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DATABASE = resolve(import.meta.dirname, '../..');
const CARPETAS = ['programmability', 'test'];
// Sentencias que modifican datos (fuera de comentarios); insertar en una variable de tabla no cuenta.
const ESCRIBE = /\b(?:INSERT\s+INTO\s+(?!@)|UPDATE\s+\w|DELETE\s+FROM|MERGE\s+)/i;
// SPs internos (sqlserver-sp §7): usan la transacción y el contexto de quien los llama.
const INTERNOS = new Set([
  'R__SP_Inventario_RegistrarMovimiento.sql',
  'R__SP_Checkout_CancelarSesionActiva.sql',
]);

function sinComentarios(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');
}

const spsQueEscriben = CARPETAS.flatMap((carpeta) =>
  readdirSync(join(DATABASE, carpeta))
    .filter((archivo) => /^R__SP_.*\.sql$/.test(archivo) && !INTERNOS.has(archivo))
    .map((archivo) => ({
      archivo,
      codigo: sinComentarios(readFileSync(join(DATABASE, carpeta, archivo), 'utf8')),
    }))
    .filter(({ codigo }) => ESCRIBE.test(codigo)),
);

// CLAUDE.md, plantilla de SP que escribe: también los de database/test (R1 del cierre de E1).
describe('todo SP que escribe sigue la plantilla', () => {
  it('hay SPs que escriben (la prueba no está vacía)', () => {
    expect(spsQueEscriben.length).toBeGreaterThan(10);
  });

  it.each(spsQueEscriben.map(({ archivo, codigo }) => [archivo, codigo] as const))(
    '%s: SET XACT_ABORT ON, TRY/CATCH con transacción y SP_Sistema_EstablecerContexto',
    (_archivo, codigo) => {
      expect(codigo).toMatch(/SET\s+XACT_ABORT\s+ON/i);
      expect(codigo).toMatch(/BEGIN\s+TRY[\s\S]*BEGIN\s+TRAN[\s\S]*BEGIN\s+CATCH/i);
      expect(codigo).toMatch(/IF\s+@@TRANCOUNT\s*>\s*0\s+ROLLBACK/i);
      expect(codigo).toMatch(/EXEC\s+dbo\.SP_Sistema_EstablecerContexto/i);
    },
  );
});
