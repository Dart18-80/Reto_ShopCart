import sql from 'mssql';
import type { Logger } from 'pino';
import type { Configuracion } from './config.ts';
import { conectar, LOGIN_MIGRADOR } from './conexion.ts';
import { leerConsulta } from './consultas.ts';
import { ErrorMigracion, mensajeDe } from './errores.ts';
import { planificar, validarIntegridad, type ScriptAplicado } from './plan.ts';
import { prepararServidor } from './preparacion.ts';
import { leerScripts, type Script, type TipoScript } from './scripts.ts';

const RECURSO_BLOQUEO = 'ShopCart.Migrador';
const ESPERA_BLOQUEO_MS = 60_000;

export async function migrar(config: Configuracion, logger: Logger): Promise<void> {
  await prepararServidor(config, logger);
  const scripts = await leerScripts(config.directorioScripts);

  const credenciales = { usuario: LOGIN_MIGRADOR, contrasena: config.contrasenaMigrador };
  // El bloqueo vive en su propia conexión, que no se reutiliza, para que dure toda la ejecución.
  const bloqueo = await conectar(config, credenciales, config.baseDatos);
  const trabajo = await conectar(config, credenciales, config.baseDatos);
  try {
    await adquirirBloqueo(bloqueo);
    const aplicados = await leerHistorial(trabajo);
    validarIntegridad(scripts, aplicados);

    const pendientes = planificar(scripts, aplicados);
    for (const script of pendientes) {
      await aplicar(trabajo, script);
      logger.info({ script: script.nombre, tipo: script.tipo }, 'Script aplicado');
    }
    logger.info(
      { baseDatos: config.baseDatos, aplicados: pendientes.length, total: scripts.length },
      pendientes.length === 0 ? 'La base ya estaba al día' : 'Migración completada',
    );
  } finally {
    await trabajo.close();
    await bloqueo.close();
  }
}

async function adquirirBloqueo(pool: sql.ConnectionPool): Promise<void> {
  const resultado = await pool
    .request()
    .input('Recurso', sql.NVarChar(255), RECURSO_BLOQUEO)
    .input('Espera', sql.Int, ESPERA_BLOQUEO_MS)
    .output('Resultado', sql.Int)
    .query(await leerConsulta('adquirir-bloqueo'));
  const codigo: unknown = resultado.output.Resultado;
  if (typeof codigo !== 'number' || codigo < 0) {
    throw new ErrorMigracion(
      `Otro migrador está aplicando scripts sobre esta base (sp_getapplock devolvió ${String(codigo)}).`,
    );
  }
}

interface FilaHistorial {
  Script: string;
  Tipo: TipoScript;
  Checksum: Buffer;
}

async function leerHistorial(pool: sql.ConnectionPool): Promise<Map<string, ScriptAplicado>> {
  const resultado = await pool.request().query<FilaHistorial>(await leerConsulta('leer-historial'));
  return new Map(
    resultado.recordset.map((fila) => [fila.Script, { tipo: fila.Tipo, checksum: fila.Checksum }]),
  );
}

// Cada script corre en su propia transacción junto con su fila de historial: o queda todo aplicado y
// registrado, o nada.
async function aplicar(pool: sql.ConnectionPool, script: Script): Promise<void> {
  const transaccion = new sql.Transaction(pool);
  await transaccion.begin();
  try {
    for (const [indice, lote] of script.lotes.entries()) {
      try {
        await new sql.Request(transaccion).batch(lote);
      } catch (error) {
        throw new ErrorMigracion(
          `Falló ${script.nombre} (lote ${String(indice + 1)} de ${String(script.lotes.length)}): ${mensajeDe(error)}`,
          { cause: error },
        );
      }
    }
    await new sql.Request(transaccion)
      .input('Script', sql.NVarChar(260), script.nombre)
      .input('Tipo', sql.Char(1), script.tipo)
      .input('Checksum', sql.VarBinary(32), script.checksum)
      .query(await leerConsulta('registrar-script'));
    await transaccion.commit();
  } catch (error) {
    await revertir(transaccion);
    throw error;
  }
}

async function revertir(transaccion: sql.Transaction): Promise<void> {
  try {
    await transaccion.rollback();
  } catch {
    // Con XACT_ABORT, SQL Server ya revirtió la transacción y el rollback del driver falla; el error
    // relevante es el original, que se relanza en aplicar().
  }
}
