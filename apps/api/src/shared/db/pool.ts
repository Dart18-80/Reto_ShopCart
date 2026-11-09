import { createRequire } from 'node:module';
import sql from 'mssql';
import type { ConfiguracionBaseDatos } from '../config/index.js';
import type { ConexionSP } from './ejecutar-sp.js';

// A-26: dos conexiones abiertas por réplica: una ráfaga no tiene que abrir conexiones nuevas (TLS y login) justo cuando
// SQL Server está más ocupado, que es cuando abrirlas puede pasar del plazo de DB_TIMEOUT_CONEXION_MS.
const CONEXIONES_MINIMAS = 2;
const CONEXIONES_MAXIMAS = 10;
// A-26: lo más que una petición espera a que el pool le entregue una conexión. Con la base en pausa, mssql valida
// cada conexión libre con un SELECT 1 que espera el requestTimeout (15 s) antes de intentar una nueva (2 s): sin
// este límite, el 503 llegaba a los 32 s (15 + 15 + 2). Con la base arriba una conexión libre se entrega en
// milisegundos, así que 5 s solo se alcanzan con la base caída o el pool saturado por más de 5 s.
const ESPERA_MAXIMA_CONEXION_MS = 5_000;

// El TimeoutError del pool de mssql (tarn), la misma clase que mssql usa: no se agrega tarn como dependencia propia.
const desdeMssql = createRequire(createRequire(import.meta.url).resolve('mssql'));
const { TimeoutError: SinConexionATiempo } = desdeMssql('tarn') as {
  TimeoutError: new (mensaje?: string) => Error;
};

/** Las opciones del pool, aparte para poder probarlas sin abrir conexiones. */
export function opcionesDelPool(config: ConfiguracionBaseDatos): sql.config {
  return {
    server: config.servidor,
    port: config.puerto,
    database: config.nombre,
    user: config.usuario,
    password: config.contrasena,
    connectionTimeout: config.tiempoMaximoConexionMs,
    requestTimeout: config.tiempoMaximoConsultaMs,
    pool: {
      min: CONEXIONES_MINIMAS,
      max: CONEXIONES_MAXIMAS,
      acquireTimeoutMillis: ESPERA_MAXIMA_CONEXION_MS,
    },
    options: { encrypt: true, trustServerCertificate: config.confiarCertificado },
  };
}

// §10: DB_USUARIO es shopcart_app, un login que solo puede ejecutar SPs.
export function conectarPool(config: ConfiguracionBaseDatos): Promise<sql.ConnectionPool> {
  return new sql.ConnectionPool(opcionesDelPool(config)).connect();
}

export function conexionMssql(pool: sql.ConnectionPool): ConexionSP {
  return {
    async ejecutar(nombre, parametros) {
      const solicitud = pool.request();
      for (const [parametro, { tipo, valor }] of Object.entries(parametros)) {
        solicitud.input(parametro, tipo, valor);
      }
      const resultado = await solicitud.execute(nombre).catch((error: unknown) => {
        // mssql deja pasar el TimeoutError del pool sin envolverlo: es no haber obtenido una conexión, igual que
        // un ConnectionError, y ejecutarSP lo responde 503 (A-26). El SP nunca corrió.
        if (error instanceof SinConexionATiempo) {
          throw new sql.ConnectionError('El pool no entregó una conexión a tiempo.', 'ETIMEOUT');
        }
        throw error;
      });
      // @types/mssql tipa los conjuntos con any: se tratan como unknown y el repositorio declara la forma.
      const conjuntos: unknown[] = Array.isArray(resultado.recordsets) ? resultado.recordsets : [];
      return conjuntos.map((conjunto) => {
        const filas: unknown[] = Array.isArray(conjunto) ? conjunto : [];
        return filas;
      });
    },
  };
}
