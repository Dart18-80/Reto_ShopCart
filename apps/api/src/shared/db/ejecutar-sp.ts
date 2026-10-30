import sql from 'mssql';
import type { Logger } from 'pino';
import { traducirErrorSql, numeroErrorSql } from '../errors/traducir-sql.js';
import { obtenerContexto } from '../http/contexto.js';

/** Solo nombres con la nomenclatura del enunciado: la firma no admite texto SQL. */
export type NombreSP = `SP_${string}_${string}`;

export interface ParametroSP {
  /** Tipo SQL explícito, idéntico al del parámetro en el SP (NVARCHAR(100) ↔ sql.NVarChar(100)). */
  tipo: sql.ISqlType | (() => sql.ISqlType);
  valor: string | number | boolean | Date | Buffer | null;
}

export type ParametrosSP = Record<string, ParametroSP>;

/** Puerto hacia SQL Server. */
export interface ConexionSP {
  ejecutar(nombre: NombreSP, parametros: ParametrosSP): Promise<unknown[][]>;
}

const PARAMETROS_ESTANDAR = ['IDUsuarioActor', 'RolActor', 'RequestId'] as const;
const DEADLOCK = 1205;
const REINTENTOS_DEADLOCK = 3;
const ESPERA_BASE_DEADLOCK_MS = 50;

interface Dependencias {
  conexion: ConexionSP;
  logger: Logger;
  /** Inyectable para que las pruebas no esperen. */
  esperar?: (ms: number) => Promise<void>;
}

// Propiedades con tipo de función: se usan sueltas (const { ejecutarSP } = ...).
export interface EjecutorSP {
  ejecutarSP: <T>(nombre: NombreSP, parametros?: ParametrosSP) => Promise<T[]>;
  ejecutarSPMultiple: (nombre: NombreSP, parametros?: ParametrosSP) => Promise<unknown[][]>;
}

export function crearEjecutorSP({ conexion, logger, esperar = dormir }: Dependencias): EjecutorSP {
  async function ejecutarSPMultiple(
    nombre: NombreSP,
    parametros: ParametrosSP = {},
  ): Promise<unknown[][]> {
    const completos = { ...parametros, ...parametrosEstandar(parametros) };

    for (let intento = 0; ; intento++) {
      const inicio = performance.now();
      try {
        const conjuntos = await conexion.ejecutar(nombre, completos);
        logger.debug(
          { sp: nombre, duracionMs: Math.round(performance.now() - inicio) },
          'SP ejecutado',
        );
        return conjuntos;
      } catch (error) {
        const numero = numeroErrorSql(error);
        // Con XACT_ABORT el SP ya revirtió todo, así que repetirlo completo es seguro.
        if (numero === DEADLOCK && intento < REINTENTOS_DEADLOCK) {
          logger.warn({ sp: nombre, intento: intento + 1 }, 'Deadlock: se reintenta el SP');
          await esperar(ESPERA_BASE_DEADLOCK_MS * 2 ** intento);
          continue;
        }
        throw traducirErrorSql(error) ?? error;
      }
    }
  }

  async function ejecutarSP<T>(nombre: NombreSP, parametros?: ParametrosSP): Promise<T[]> {
    const [primero = []] = await ejecutarSPMultiple(nombre, parametros);
    // El SP define la forma de sus filas y el repositorio la declara en T.
    return primero as T[];
  }

  return { ejecutarSP, ejecutarSPMultiple };
}

// A-18: el actor sale siempre del contexto de la petición, nunca del llamador (RF-01).
function parametrosEstandar(parametros: ParametrosSP): ParametrosSP {
  // SQL Server no distingue mayúsculas en los nombres de parámetros.
  const recibidos = Object.keys(parametros).map((nombre) => nombre.toLowerCase());
  const repetido = PARAMETROS_ESTANDAR.find((nombre) => recibidos.includes(nombre.toLowerCase()));
  if (repetido !== undefined) {
    throw new Error(`@${repetido} lo agrega ejecutarSP desde el contexto; no se pasa a mano.`);
  }
  const contexto = obtenerContexto();
  return {
    IDUsuarioActor: { tipo: sql.Int, valor: contexto?.idUsuario ?? null },
    RolActor: { tipo: sql.VarChar(20), valor: contexto?.rol ?? null },
    RequestId: { tipo: sql.UniqueIdentifier, valor: contexto?.requestId ?? null },
  };
}

function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
