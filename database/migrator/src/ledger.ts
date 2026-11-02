import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sql from 'mssql';
import type { Logger } from 'pino';
import type { Configuracion } from './config.ts';
import { conectar, LOGIN_ADMIN } from './conexion.ts';
import { leerConsulta } from './consultas.ts';
import { mensajeDe } from './errores.ts';

export class ErrorLedger extends Error {
  constructor(mensaje: string, opciones?: ErrorOptions) {
    super(mensaje, opciones);
    this.name = 'ErrorLedger';
  }
}

interface FilaDigest {
  latest_digest: string | null;
}

interface FilaCreacion {
  CreadaEn: string;
}

/**
 * M-01: genera el digest del ledger, lo agrega a un archivo fuera de la base (uno por base y por fecha de
 * creación) y verifica la base contra todos los digests guardados. Un cambio en una tabla ledger o en un bloque
 * posterior a cualquiera de ellos hace fallar la verificación. En producción el archivo iría a un almacenamiento
 * inmutable (por ejemplo, un blob con retención).
 */
export async function verificarLedger(
  config: Configuracion,
  directorio: string,
  logger: Logger,
): Promise<{ digests: number; archivo: string }> {
  const pool = await conectar(
    config,
    { usuario: LOGIN_ADMIN, contrasena: config.contrasenaAdmin },
    config.baseDatos,
  );
  try {
    const { recordsets } = await pool.request().query(await leerConsulta('generar-digest-ledger'));
    const [digests, creacion] = recordsets as unknown as [FilaDigest[], FilaCreacion[]];
    const digest = digests[0]?.latest_digest;
    const creadaEn = creacion[0]?.CreadaEn;
    if (digest == null || creadaEn === undefined) {
      throw new ErrorLedger(
        `La base ${config.baseDatos} todavía no tiene transacciones en sus tablas ledger.`,
      );
    }

    // Los dos puntos de la hora no son válidos en un nombre de archivo de Windows.
    const archivo = join(directorio, `${config.baseDatos}-${creadaEn.replaceAll(':', '')}.jsonl`);
    await mkdir(directorio, { recursive: true });
    await appendFile(archivo, `${digest}\n`);
    const guardados = (await readFile(archivo, 'utf8')).split('\n').filter((linea) => linea !== '');

    try {
      await pool
        .request()
        .input('Digests', sql.NVarChar(sql.MAX), `[${guardados.join(',')}]`)
        .query(await leerConsulta('verificar-ledger'));
    } catch (error) {
      throw new ErrorLedger(
        `El ledger de ${config.baseDatos} no coincide con los digests guardados en ${archivo}: ${mensajeDe(error)}`,
        { cause: error },
      );
    }
    logger.info(
      { baseDatos: config.baseDatos, digests: guardados.length, archivo },
      'Ledger verificado: ninguna tabla ledger cambió desde los digests guardados',
    );
    return { digests: guardados.length, archivo };
  } finally {
    await pool.close();
  }
}
