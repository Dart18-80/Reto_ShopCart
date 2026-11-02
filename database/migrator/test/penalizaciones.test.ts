import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// E8-H02: la checklist del enunciado §08 (penalización directa) y §05 (tipos), sobre todos los scripts.
const DATABASE = resolve(import.meta.dirname, '../..');
const CARPETAS = ['migrations', 'programmability', 'seeds', 'test'];
// Herramienta de despliegue: un identificador o una contraseña de login no aceptan parámetros, y la única
// concatenación admitida es con QUOTENAME (sqlserver-sp §11).
const SCRIPTS_DEL_MIGRADOR = 'migrator/sql';
const TIPOS_PROHIBIDOS =
  /\b(FLOAT|REAL|MONEY|SMALLMONEY|DATETIME|SMALLDATETIME|TEXT|NTEXT|IMAGE)\b/i;
const LITERAL = "'S'";
// Sin SQL en el backend: ninguna sentencia en el código TypeScript de la API, las pruebas, el paquete compartido
// ni el código del migrador (sus consultas viven en archivos .sql). Las pruebas del migrador quedan fuera: su
// SQL es el texto de entrada del lector de scripts.
const RAIZ = resolve(DATABASE, '..');
const CODIGO_TS = ['apps/api/src', 'apps/api/test', 'packages/shared/src', 'database/migrator/src'];
const SENTENCIA_SQL =
  /\b(?:SELECT\s+[\s\S]{0,200}?\bFROM\s+[\w[]|INSERT\s+(?:INTO\s+)?(?:dbo\.|\[)[\w\]]|INSERT\s+INTO\s+\w|UPDATE\s+[\w.[\]]+\s+SET\s|DELETE\s+(?:FROM\s+)?(?:dbo\.|\[)|DELETE\s+FROM\s+\w|MERGE\s+(?:INTO\s+)?[\w[]+[\w.\]]*\s+(?:AS\s+\w+\s+)?USING\b|TRUNCATE\s+TABLE\s|EXEC(?:UTE)?\s+(?:dbo\.|sys\.)?\w+_\w+|CREATE\s+(?:TABLE|PROCEDURE|VIEW)\s)/;
// Llamadas de mssql que aceptan texto SQL: la API solo usa request.execute(nombreDelSP).
const TEXTO_A_MSSQL = /\.(?:query|batch)\s*\(/;

interface Script {
  archivo: string;
  codigo: string;
}

/** Quita los comentarios y reemplaza cada literal de texto por 'S', en una sola pasada. */
function normalizar(sql: string): string {
  let codigo = '';
  for (let i = 0; i < sql.length;) {
    if (sql.startsWith('--', i)) {
      const fin = sql.indexOf('\n', i);
      i = fin === -1 ? sql.length : fin;
    } else if (sql.startsWith('/*', i)) {
      const fin = sql.indexOf('*/', i + 2);
      i = fin === -1 ? sql.length : fin + 2;
    } else if (sql[i] === "'") {
      let fin = i + 1;
      while (fin < sql.length && !(sql[fin] === "'" && sql[fin + 1] !== "'")) {
        fin += sql[fin] === "'" ? 2 : 1;
      }
      codigo += LITERAL;
      i = fin + 1;
    } else {
      codigo += sql.charAt(i);
      i += 1;
    }
  }
  return codigo;
}

function leerScripts(carpeta: string): Script[] {
  return readdirSync(join(DATABASE, carpeta))
    .filter((archivo) => archivo.endsWith('.sql'))
    .map((archivo) => ({
      archivo: `${carpeta}/${archivo}`,
      codigo: normalizar(readFileSync(join(DATABASE, carpeta, archivo), 'utf8')),
    }));
}

const scripts = CARPETAS.flatMap(leerScripts);
const codigoTs = CODIGO_TS.flatMap((carpeta) =>
  readdirSync(join(RAIZ, carpeta), { recursive: true, encoding: 'utf8' })
    .filter((archivo) => archivo.endsWith('.ts'))
    .map((archivo) => ({
      archivo: relative(RAIZ, join(RAIZ, carpeta, archivo)),
      codigo: readFileSync(join(RAIZ, carpeta, archivo), 'utf8'),
    })),
);
const scriptsDelMigrador = leerScripts(SCRIPTS_DEL_MIGRADOR);

/** Lo que se asigna a una variable (DECLARE @V ... = x; SET o SELECT @V = x; SET @V += x;), hasta el ;. */
function asignaciones(codigo: string, variable: string): string[] {
  const patron = new RegExp(
    `(?:DECLARE\\s+@${variable}\\b[^=;]*=|(?:SET|SELECT)\\s+@${variable}\\s*\\+?=)\\s*([\\s\\S]*?)(?:;|\\n\\s*\\n|$)`,
    'gi',
  );
  return [...codigo.matchAll(patron)].map((m) => (m[1] ?? '').trim());
}

/** Un CASE que solo elige entre fragmentos constantes (las condiciones pueden usar valores). */
function soloEligeLiterales(expresion: string): boolean {
  const resultados = [...expresion.matchAll(/\b(?:THEN|ELSE)\s+(\S+)/gi)].map((m) => m[1] ?? '');
  return resultados.length > 0 && resultados.every((resultado) => /^N?'S'$/.test(resultado));
}

const operandos = (expresion: string): string[] =>
  expresion.split('+').map((operando) => operando.trim());

/**
 * Lo que se concatena en el texto de un SQL dinámico solo puede ser un literal, una variable armada solo con
 * literales o, en los scripts del migrador, QUOTENAME(...). Devuelve los operandos que no cumplen.
 */
function concatenacionesInseguras(codigo: string, permitirQuotename: boolean): string[] {
  const esSeguro = (operando: string, visitadas: Set<string>): boolean => {
    if (/^N?'S'$/.test(operando)) return true;
    if (permitirQuotename && /^QUOTENAME\(/i.test(operando)) return true;
    if (/^CASE\b/i.test(operando)) return soloEligeLiterales(operando);
    const variable = /^@(\w+)$/.exec(operando)?.[1];
    if (variable === undefined || visitadas.has(variable)) return false;
    // Un parámetro o una variable sin asignación conocida trae un valor de afuera: nunca es seguro.
    const expresiones = asignaciones(codigo, variable);
    return (
      expresiones.length > 0 &&
      expresiones.every((expresion) =>
        operandos(expresion).every((o) => esSeguro(o, new Set([...visitadas, variable]))),
      )
    );
  };
  // Cada asignación de la variable que se ejecuta se revisa, tenga o no un +: una copia de otra variable
  // (SET @Sql = @Base) o un CONCAT(...) también traen lo que haya en ellos.
  const dinamicas = [...codigo.matchAll(/sp_executesql\s+(?:@stmt\s*=\s*)?@(\w+)/gi)].map(
    (m) => m[1] ?? '',
  );
  return dinamicas.flatMap((variable) =>
    asignaciones(codigo, variable)
      .flatMap(operandos)
      .filter((operando) => !esSeguro(operando, new Set([variable]))),
  );
}

describe('checklist de penalizaciones sobre los scripts (E8-H02)', () => {
  it('lee los scripts (la prueba no está vacía)', () => {
    expect(scripts.length).toBeGreaterThan(200);
    expect(scripts.some(({ codigo }) => /sp_executesql/i.test(codigo))).toBe(true);
  });

  it('§05: ningún FLOAT, REAL, MONEY, DATETIME, TEXT, NTEXT ni IMAGE fuera de comentarios y textos', () => {
    const conTipoProhibido = [...scripts, ...scriptsDelMigrador]
      .filter(({ codigo }) => TIPOS_PROHIBIDOS.test(codigo))
      .map(({ archivo, codigo }) => `${archivo}: ${TIPOS_PROHIBIDOS.exec(codigo)?.[0] ?? ''}`);

    expect(conTipoProhibido).toEqual([]);
  });

  it('§08: el SQL dinámico solo corre con sp_executesql, nunca con EXEC(...)', () => {
    const conExec = [...scripts, ...scriptsDelMigrador]
      .filter(({ codigo }) => /\bEXEC(?:UTE)?\s*\(/i.test(codigo))
      .map(({ archivo }) => archivo);

    expect(conExec).toEqual([]);
  });

  it('§08: el texto de un SQL dinámico nunca concatena valores, solo fragmentos constantes', () => {
    const inseguros = scripts.flatMap(({ archivo, codigo }) =>
      concatenacionesInseguras(codigo, false).map((operando) => `${archivo}: ${operando}`),
    );

    expect(inseguros).toEqual([]);
  });

  it('§08: en el migrador solo se concatena un identificador o una contraseña con QUOTENAME', () => {
    const inseguros = scriptsDelMigrador.flatMap(({ archivo, codigo }) =>
      concatenacionesInseguras(codigo, true).map((operando) => `${archivo}: ${operando}`),
    );

    expect(inseguros).toEqual([]);
  });

  it('detecta una concatenación insegura (la regla no es vacía)', () => {
    const codigo = normalizar(
      "DECLARE @Sql NVARCHAR(MAX) = N'SELECT 1 WHERE x = ''' + @Valor + N'''';\nEXEC sys.sp_executesql @Sql;",
    );

    expect(concatenacionesInseguras(codigo, false)).toEqual(['@Valor']);
  });

  it.each([
    ['SELECT @V =', "SELECT @Sql = N'SELECT 1 WHERE x = ''' + @Valor;\nEXEC sp_executesql @Sql;"],
    ['CONCAT', "SET @Sql = CONCAT(N'SELECT ', @Valor);\nEXEC sp_executesql @Sql;"],
    ['una copia', "SET @Base = N'SELECT ' + @Valor;\nSET @Sql = @Base;\nEXEC sp_executesql @Sql;"],
    ['@stmt =', "SET @Sql = N'SELECT ' + @Valor;\nEXEC sp_executesql @stmt = @Sql;"],
  ])('detecta la concatenación insegura con %s', (_caso, sql) => {
    expect(concatenacionesInseguras(normalizar(sql), false)).not.toEqual([]);
  });
});

describe('sin SQL en el backend (E8-H02, enunciado §08)', () => {
  it('lee el código (la prueba no está vacía)', () => {
    expect(codigoTs.length).toBeGreaterThan(150);
  });

  it('ningún archivo TypeScript del backend contiene una sentencia SQL', () => {
    const conSql = codigoTs
      .filter(({ codigo }) => SENTENCIA_SQL.test(codigo))
      .map(({ archivo, codigo }) => `${archivo}: ${SENTENCIA_SQL.exec(codigo)?.[0] ?? ''}`);

    expect(conSql).toEqual([]);
  });

  it('la API nunca pasa texto a mssql (ni query ni batch): solo ejecuta SPs', () => {
    const conTexto = codigoTs
      .filter(({ archivo }) => archivo.startsWith(join('apps', 'api', 'src')))
      .filter(({ codigo }) => TEXTO_A_MSSQL.test(codigo))
      .map(({ archivo }) => archivo);

    expect(conTexto).toEqual([]);
  });

  it('detecta una consulta escrita en el código (la regla no es vacía)', () => {
    expect(SENTENCIA_SQL.test('const sql = `SELECT Nombre FROM dbo.Producto`;')).toBe(true);
    expect(SENTENCIA_SQL.test("await request.query('EXEC dbo.SP_Catalogo_Listar')")).toBe(true);
    for (const sentencia of [
      'UPDATE dbo.Producto SET Precio = 1',
      'UPDATE [dbo].[Producto] SET Precio = 1',
      'DELETE dbo.Producto WHERE 1 = 1',
      'DELETE FROM Producto',
      'MERGE dbo.Producto AS t USING',
      'INSERT dbo.Producto (Nombre) VALUES (1)',
    ]) {
      expect(SENTENCIA_SQL.test(sentencia), sentencia).toBe(true);
    }
  });
});
