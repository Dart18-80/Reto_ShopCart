import sql from 'mssql';
import type { ConfiguracionBaseDatos } from '../config/index.js';
import type { ConexionSP } from './ejecutar-sp.js';

// A-26: dos conexiones abiertas por réplica: una ráfaga no tiene que abrir conexiones nuevas (TLS y login) justo cuando
// SQL Server está más ocupado, que es cuando abrirlas puede pasar del plazo de DB_TIMEOUT_CONEXION_MS.
const CONEXIONES_MINIMAS = 2;
const CONEXIONES_MAXIMAS = 10;

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
    pool: { min: CONEXIONES_MINIMAS, max: CONEXIONES_MAXIMAS },
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
      const resultado = await solicitud.execute(nombre);
      // @types/mssql tipa los conjuntos con any: se tratan como unknown y el repositorio declara la forma.
      const conjuntos: unknown[] = Array.isArray(resultado.recordsets) ? resultado.recordsets : [];
      return conjuntos.map((conjunto) => {
        const filas: unknown[] = Array.isArray(conjunto) ? conjunto : [];
        return filas;
      });
    },
  };
}
