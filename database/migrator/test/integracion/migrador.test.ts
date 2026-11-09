import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sql from 'mssql';
import { pino, type Logger } from 'pino';
import { describe, expect, it } from 'vitest';
import { leerConfiguracion, type Configuracion } from '../../src/config.ts';
import { conectar, LOGIN_APP, LOGIN_MIGRADOR } from '../../src/conexion.ts';
import { ErrorMigracion } from '../../src/errores.ts';
import { migrar } from '../../src/migrador.ts';

// Cada prueba recrea shopcart_test con sus propios escenarios; `pnpm test:integracion` la vuelve a
// migrar con los scripts reales antes de las pruebas de la API.
const ESCENARIOS = resolve(import.meta.dirname, 'escenarios');
const ERROR_PERMISO_DENEGADO = 229;

interface LineaLog {
  msg: string;
  aplicados?: number;
}

function registro(): { logger: Logger; lineas: LineaLog[] } {
  const lineas: LineaLog[] = [];
  const logger = pino(
    { level: 'info' },
    {
      write: (linea: string) => {
        lineas.push(JSON.parse(linea) as LineaLog);
      },
    },
  );
  return { logger, lineas };
}

function configuracion(escenario: string | undefined, recrearBase: boolean): Configuracion {
  const base = leerConfiguracion(process.env, ['--pruebas']);
  return {
    ...base,
    recrearBase,
    directorioScripts:
      escenario === undefined ? base.directorioScripts : resolve(ESCENARIOS, escenario),
  };
}

const consulta = (archivo: string) =>
  readFile(resolve(import.meta.dirname, 'consultas', archivo), 'utf8');

function aplicadosEn(lineas: LineaLog[]): number | undefined {
  return lineas.find((linea) => linea.aplicados !== undefined)?.aplicados;
}

describe('migrar contra SQL Server (E0-H03, A-09)', () => {
  it('ejecutarlo dos veces seguidas no aplica nada la segunda vez', async () => {
    await migrar(configuracion('basico', true), registro().logger);
    const segunda = registro();

    await migrar(configuracion('basico', false), segunda.logger);

    expect(aplicadosEn(segunda.lineas)).toBe(0);
    expect(segunda.lineas.map((linea) => linea.msg)).toContain('La base ya estaba al día');
  });

  it('modificar un V### ya aplicado hace fallar el migrador con un mensaje claro', async () => {
    await migrar(configuracion('basico', true), registro().logger);

    const intento = migrar(configuracion('modificado', false), registro().logger);

    await expect(intento).rejects.toBeInstanceOf(ErrorMigracion);
    await expect(intento).rejects.toThrow(/V001__uno\.sql cambió después de aplicarse/);
  });

  it('un script que falla a la mitad no deja nada aplicado ni registrado, y se puede corregir', async () => {
    const fallido = migrar(configuracion('con-error', true), registro().logger);
    await expect(fallido).rejects.toThrow(/Falló V002__dos\.sql \(lote 2 de 2\)/);

    // El V002 corregido vuelve a crear dbo.Dos (fallaría si el primer lote hubiera quedado) y el V001
    // no se reaplica (fallaría su CREATE TABLE).
    const corregido = registro();
    await migrar(configuracion('corregido', false), corregido.logger);

    expect(aplicadosEn(corregido.lineas)).toBe(1);
  });

  it('dos migradores a la vez: el bloqueo hace que cada script se aplique una sola vez', async () => {
    await migrar(configuracion('vacio', true), registro().logger);
    const [primero, segundo] = [registro(), registro()];

    await Promise.all([
      migrar(configuracion('lento', false), primero.logger),
      migrar(configuracion('lento', false), segundo.logger),
    ]);

    expect([aplicadosEn(primero.lineas), aplicadosEn(segundo.lineas)].sort()).toEqual([0, 1]);
  });

  it('con el servidor inaccesible falla en lugar de quedarse esperando', async () => {
    const inaccesible = { ...configuracion('basico', false), puerto: 1 };

    await expect(migrar(inaccesible, registro().logger)).rejects.toThrow(/Failed to connect/);
  });
});

describe('estadísticas al día después de migrar (A-27)', () => {
  it('si aplicó scripts, actualiza las estadísticas: la primera consulta no paga su actualización', async () => {
    const config = configuracion('con-datos', true);
    const { logger, lineas } = registro();

    await migrar(config, logger);

    const pool = await conectar(
      config,
      { usuario: LOGIN_MIGRADOR, contrasena: config.contrasenaMigrador },
      config.baseDatos,
    );
    try {
      const { recordset } = await pool
        .request()
        .query<{ Pendientes: number }>(await consulta('estadisticas-pendientes.sql'));
      expect(recordset[0]?.Pendientes).toBe(0);
    } finally {
      await pool.close();
    }
    expect(lineas.map((linea) => linea.msg)).toContain('Estadísticas actualizadas');
  });

  it('si no había nada que aplicar, no las toca', async () => {
    await migrar(configuracion('con-datos', true), registro().logger);
    const segunda = registro();

    await migrar(configuracion('con-datos', false), segunda.logger);

    expect(segunda.lineas.map((linea) => linea.msg)).not.toContain('Estadísticas actualizadas');
  });
});

describe('permisos de shopcart_app tras migrar los scripts reales (E0-H03, §10)', () => {
  it('ejecuta SP_Sistema_Health, pero un SELECT directo a una tabla devuelve error de permisos', async () => {
    const config = configuracion(undefined, true);
    await migrar(config, registro().logger);
    const app = await conectar(
      config,
      { usuario: LOGIN_APP, contrasena: config.contrasenaApp },
      config.baseDatos,
    );
    try {
      const health = await app.request().execute('SP_Sistema_Health');
      const lectura = app
        .request()
        .query(
          await readFile(resolve(import.meta.dirname, 'consultas/leer-tabla-directo.sql'), 'utf8'),
        );

      expect(health.recordset).toHaveLength(1);
      await expect(lectura).rejects.toMatchObject({ number: ERROR_PERMISO_DENEGADO });
    } finally {
      await app.close();
    }
  });

  it('A-23: shopcart_app no lee la vista de la tienda, pero la búsqueda funciona llamada por shopcart_app', async () => {
    const config = configuracion(undefined, true);
    await migrar(config, registro().logger);
    const app = await conectar(
      config,
      { usuario: LOGIN_APP, contrasena: config.contrasenaApp },
      config.baseDatos,
    );
    try {
      await expect(
        app.request().query(await consulta('leer-vista-directo.sql')),
      ).rejects.toMatchObject({ number: ERROR_PERMISO_DENEGADO });
      const busqueda = await app
        .request()
        .input('Texto', sql.NVarChar(150), null)
        .input('IDCategoria', sql.Int, null)
        .input('PrecioMin', sql.Decimal(12, 2), null)
        .input('PrecioMax', sql.Decimal(12, 2), null)
        .input('Disponible', sql.Bit, null)
        .input('Orden', sql.VarChar(20), 'precio')
        .input('Direccion', sql.VarChar(4), 'asc')
        .input('Pagina', sql.Int, 1)
        .input('Tamano', sql.Int, 5)
        .execute('SP_Catalogo_BuscarProductos');

      expect(busqueda.recordset).toHaveLength(5);
    } finally {
      await app.close();
    }
  });

  it('A-23: shopcart_busqueda lee la vista de la tienda y nada más: ninguna tabla, Usuario incluida', async () => {
    const config = configuracion(undefined, true);
    await migrar(config, registro().logger);
    const migrador = await conectar(
      config,
      { usuario: LOGIN_MIGRADOR, contrasena: config.contrasenaMigrador },
      config.baseDatos,
    );
    try {
      const vista = await migrador.request().query(await consulta('busqueda-lee-vista.sql'));

      expect(vista.recordset).toHaveLength(1);
      for (const tabla of ['busqueda-lee-usuario.sql', 'busqueda-lee-producto.sql']) {
        await expect(migrador.request().query(await consulta(tabla))).rejects.toMatchObject({
          number: ERROR_PERMISO_DENEGADO,
        });
      }
    } finally {
      await migrador.close();
    }
  });

  it('ejecutar el migrador real por segunda vez no aplica nada', async () => {
    await migrar(configuracion(undefined, true), registro().logger);
    const segunda = registro();

    await migrar(configuracion(undefined, false), segunda.logger);

    expect(aplicadosEn(segunda.lineas)).toBe(0);
  });
});
