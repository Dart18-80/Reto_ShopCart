import sql from 'mssql';
import type { ConfiguracionBaseDatos } from '../config/index.js';
import type { ConexionSP } from './ejecutar-sp.js';

// §10: la API se conecta con un login que solo puede ejecutar SPs.
const LOGIN_APP = 'shopcart_app';

export function conectarPool(config: ConfiguracionBaseDatos): Promise<sql.ConnectionPool> {
  return new sql.ConnectionPool({
    server: config.servidor,
    port: config.puerto,
    database: config.nombre,
    user: LOGIN_APP,
    password: config.contrasena,
    pool: { min: 0, max: 10 },
    options: { encrypt: true, trustServerCertificate: config.confiarCertificado },
  }).connect();
}

/** Adaptador del puerto ConexionSP sobre mssql: request.execute() solo acepta el nombre de un SP. */
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
