import { Decimal } from 'decimal.js';
import sql from 'mssql';
import { pino } from 'pino';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import type {
  ConexionSP,
  EjecutorSP,
  NombreSP,
  ParametroSP,
} from '../../../../src/shared/db/ejecutar-sp.js';
import { crearEjecutorSP } from '../../../../src/shared/db/ejecutar-sp.js';
import { AppError } from '../../../../src/shared/errors/app-error.js';
import { ejecutarConContexto } from '../../../../src/shared/http/contexto.js';

const logger = pino({ level: 'silent' });
const sinEspera = (): Promise<void> => Promise.resolve();

function conexionFalsa(respuesta: () => Promise<unknown[][]>) {
  const ejecutar = vi.fn<ConexionSP['ejecutar']>(respuesta);
  return { conexion: { ejecutar }, ejecutar };
}

const errorSql = (numero: number): Error =>
  Object.assign(new Error(`error ${String(numero)}`), { number: numero });

function valores(parametros: Record<string, ParametroSP> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(parametros ?? {}).map(([n, p]) => [n, p.valor]));
}

describe('ejecutarSP', () => {
  it('A-18: agrega @IDUsuarioActor, @RolActor y @RequestId desde el contexto de la petición', async () => {
    const { conexion, ejecutar } = conexionFalsa(() => Promise.resolve([[{ Uno: 1 }]]));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await ejecutarConContexto(
      { requestId: '8f1c2e9a-0000-4000-8000-000000000001', idUsuario: 7, rol: 'Cliente' },
      () => ejecutarSP('SP_Pruebas_Leer', { Pagina: { tipo: sql.Int, valor: 2 } }),
    );

    const [nombre, parametros] = ejecutar.mock.calls[0] ?? [];
    expect(nombre).toBe('SP_Pruebas_Leer');
    expect(valores(parametros)).toEqual({
      Pagina: 2,
      IDUsuarioActor: 7,
      RolActor: 'Cliente',
      RequestId: '8f1c2e9a-0000-4000-8000-000000000001',
    });
  });

  it('A-18: fuera de una petición (jobs) envía el rol Sistema, sin usuario ni RequestId', async () => {
    const { conexion, ejecutar } = conexionFalsa(() => Promise.resolve([[]]));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await ejecutarSP('SP_Pruebas_Leer');

    expect(valores(ejecutar.mock.calls[0]?.[1])).toEqual({
      IDUsuarioActor: null,
      RolActor: 'Sistema',
      RequestId: null,
    });
  });

  it('en una petición sin usuario (invitado) el rol va en NULL, nunca Sistema', async () => {
    const { conexion, ejecutar } = conexionFalsa(() => Promise.resolve([[]]));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await ejecutarConContexto(
      { requestId: '8f1c2e9a-0000-4000-8000-000000000003', idUsuario: null, rol: null },
      () => ejecutarSP('SP_Pruebas_Leer'),
    );

    expect(valores(ejecutar.mock.calls[0]?.[1])).toMatchObject({ RolActor: null });
  });

  it('RF-01: rechaza que el llamador envíe un parámetro estándar', async () => {
    const { conexion, ejecutar } = conexionFalsa(() => Promise.resolve([[]]));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await expect(
      ejecutarSP('SP_Pruebas_Leer', { IDUsuarioActor: { tipo: sql.Int, valor: 99 } }),
    ).rejects.toThrow(/IDUsuarioActor/);
    expect(ejecutar).not.toHaveBeenCalled();
  });

  it('RF-01: también lo rechaza si el nombre difiere solo en mayúsculas', async () => {
    const { conexion, ejecutar } = conexionFalsa(() => Promise.resolve([[]]));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await expect(
      ejecutarSP('SP_Pruebas_Leer', { idUsuarioActor: { tipo: sql.Int, valor: 99 } }),
    ).rejects.toThrow(/IDUsuarioActor/);
    expect(ejecutar).not.toHaveBeenCalled();
  });

  it('ejecutarSP devuelve solo las filas del primer conjunto de resultados', async () => {
    const { conexion } = conexionFalsa(() => Promise.resolve([[{ A: 1 }, { A: 2 }], [{ B: 3 }]]));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    const filas = await ejecutarSP<{ A: number }>('SP_Pruebas_Leer');

    expect(filas).toEqual([{ A: 1 }, { A: 2 }]);
  });

  it('ejecutarSPMultiple devuelve todos los conjuntos de resultados', async () => {
    const { conexion } = conexionFalsa(() => Promise.resolve([[{ A: 1 }, { A: 2 }], [{ B: 3 }]]));
    const { ejecutarSPMultiple } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    const conjuntos = await ejecutarSPMultiple('SP_Pruebas_Leer');

    expect(conjuntos).toEqual([[{ A: 1 }, { A: 2 }], [{ B: 3 }]]);
  });

  it('convierte un THROW de negocio en AppError sin reintentar', async () => {
    const { conexion, ejecutar } = conexionFalsa(() => Promise.reject(errorSql(50003)));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    const error: unknown = await ejecutarSP('SP_Pruebas_Fallar').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ codigo: 'PARAMETRO_INVALIDO', status: 400 });
    expect(ejecutar).toHaveBeenCalledTimes(1);
  });

  it('reintenta ante un deadlock (1205) y devuelve el resultado si un reintento funciona', async () => {
    let intentos = 0;
    const { conexion, ejecutar } = conexionFalsa(() => {
      intentos += 1;
      return intentos < 3 ? Promise.reject(errorSql(1205)) : Promise.resolve([[{ Ok: 1 }]]);
    });
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await expect(ejecutarSP('SP_Pruebas_Escribir')).resolves.toEqual([{ Ok: 1 }]);
    expect(ejecutar).toHaveBeenCalledTimes(3);
  });

  it('después de 3 reintentos por deadlock propaga el error', async () => {
    const { conexion, ejecutar } = conexionFalsa(() => Promise.reject(errorSql(1205)));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await expect(ejecutarSP('SP_Pruebas_Escribir')).rejects.toThrow('error 1205');
    expect(ejecutar).toHaveBeenCalledTimes(4);
  });

  it('un error de SQL que no es de negocio se propaga tal cual (termina en 500)', async () => {
    const { conexion } = conexionFalsa(() => Promise.reject(errorSql(229)));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await expect(ejecutarSP('SP_Pruebas_Leer')).rejects.not.toBeInstanceOf(AppError);
  });

  it('una conexión perdida (error sin número) se propaga sin reintentar', async () => {
    const perdida = Object.assign(new Error('Connection lost - read ECONNRESET'), {
      code: 'ESOCKET',
    });
    const { conexion, ejecutar } = conexionFalsa(() => Promise.reject(perdida));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await expect(ejecutarSP('SP_Pruebas_Leer')).rejects.toBe(perdida);
    expect(ejecutar).toHaveBeenCalledTimes(1);
  });

  it('no poder obtener una conexión es 503 BASE_NO_DISPONIBLE con Retry-After, sin reintentar', async () => {
    const sinConexion = new sql.ConnectionError(
      'Failed to connect to sqlserver:1433 in 2000ms',
      'ETIMEOUT',
    );
    const { conexion, ejecutar } = conexionFalsa(() => Promise.reject(sinConexion));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    const error = await ejecutarSP('SP_Pruebas_Leer').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      codigo: 'BASE_NO_DISPONIBLE',
      status: 503,
      segundosParaReintentar: 5,
      cause: sinConexion,
    });
    expect(ejecutar).toHaveBeenCalledTimes(1);
  });

  it('un timeout de la consulta no es 503: el SP pudo haber corrido y sigue siendo un 500', async () => {
    const lenta = new sql.RequestError(
      'Timeout: Request failed to complete in 15000ms',
      'ETIMEOUT',
    );
    const { conexion } = conexionFalsa(() => Promise.reject(lenta));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await expect(ejecutarSP('SP_Pruebas_Leer')).rejects.toBe(lenta);
  });

  it('entre reintentos por deadlock espera 50, 100 y 200 ms (backoff exponencial)', async () => {
    const esperas: number[] = [];
    const { conexion } = conexionFalsa(() => Promise.reject(errorSql(1205)));
    const { ejecutarSP } = crearEjecutorSP({
      conexion,
      logger,
      esperar: (ms) => {
        esperas.push(ms);
        return Promise.resolve();
      },
    });

    await ejecutarSP('SP_Pruebas_Escribir').catch(() => undefined);

    expect(esperas).toEqual([50, 100, 200]);
  });

  it('si tras un deadlock el reintento falla por una regla de negocio, devuelve ese AppError', async () => {
    let intentos = 0;
    const { conexion } = conexionFalsa(() => {
      intentos += 1;
      return Promise.reject(errorSql(intentos === 1 ? 1205 : 50301));
    });
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await expect(ejecutarSP('SP_Pruebas_Escribir')).rejects.toMatchObject({
      codigo: 'STOCK_INSUFICIENTE',
    });
  });

  it('los reintentos envían el mismo actor que la primera ejecución', async () => {
    let intentos = 0;
    const { conexion, ejecutar } = conexionFalsa(() => {
      intentos += 1;
      return intentos === 1 ? Promise.reject(errorSql(1205)) : Promise.resolve([[]]);
    });
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await ejecutarConContexto(
      { requestId: '8f1c2e9a-0000-4000-8000-000000000002', idUsuario: 3, rol: 'Operador' },
      () => ejecutarSP('SP_Pruebas_Escribir'),
    );

    const [primera, segunda] = ejecutar.mock.calls.map(([, parametros]) => valores(parametros));
    expect(segunda).toEqual(primera);
  });

  it('pasa los parámetros con valor null tal cual', async () => {
    const { conexion, ejecutar } = conexionFalsa(() => Promise.resolve([[]]));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await ejecutarSP('SP_Pruebas_Leer', { Referencia: { tipo: sql.NVarChar(100), valor: null } });

    expect(valores(ejecutar.mock.calls[0]?.[1])).toMatchObject({ Referencia: null });
  });

  it('un SP sin conjuntos de resultados devuelve una lista vacía', async () => {
    const { conexion } = conexionFalsa(() => Promise.resolve([]));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await expect(ejecutarSP('SP_Pruebas_Escribir')).resolves.toEqual([]);
  });

  it('A-18: con peticiones concurrentes, cada SP recibe el actor de su propia petición', async () => {
    // La conexión tarda distinto en cada llamada para que las peticiones se intercalen.
    const { conexion, ejecutar } = conexionFalsa(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve([[]]);
          }, Math.random() * 20);
        }),
    );
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });
    const peticiones = Array.from({ length: 20 }, (_, indice) => indice + 1);

    await Promise.all(
      peticiones.map((idUsuario) =>
        ejecutarConContexto(
          { requestId: crypto.randomUUID(), idUsuario, rol: 'Cliente' },
          async () => {
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
            return ejecutarSP('SP_Pruebas_Leer', { Marca: { tipo: sql.Int, valor: idUsuario } });
          },
        ),
      ),
    );

    for (const [, parametros] of ejecutar.mock.calls) {
      const { Marca, IDUsuarioActor } = valores(parametros);
      expect(IDUsuarioActor).toBe(Marca);
    }
    expect(ejecutar).toHaveBeenCalledTimes(peticiones.length);
  });

  it('A-19: un JSON inválido en el THROW se registra como error con el SP, aunque el cliente vea el mensaje del catálogo', async () => {
    const lineas: string[] = [];
    const loggerEnMemoria = pino(
      { level: 'info' },
      {
        write: (linea: string) => {
          lineas.push(linea);
        },
      },
    );
    const roto = Object.assign(new Error('{"mensaje":"Sin existencia.","detalles":[1]'), {
      number: 50301,
    });
    const { conexion } = conexionFalsa(() => Promise.reject(roto));
    const { ejecutarSP } = crearEjecutorSP({
      conexion,
      logger: loggerEnMemoria,
      esperar: sinEspera,
    });

    await expect(ejecutarSP('SP_Pruebas_Fallar')).rejects.toMatchObject({
      codigo: 'STOCK_INSUFICIENTE',
      message: 'No hay existencia suficiente.',
    });
    const registro = lineas.find((linea) => linea.includes('A-19'));
    expect(registro).toContain('"level":50');
    expect(registro).toContain('SP_Pruebas_Fallar');
  });

  it('A-19: un THROW con JSON válido no deja error en el log', async () => {
    const lineas: string[] = [];
    const loggerEnMemoria = pino(
      { level: 'info' },
      {
        write: (linea: string) => {
          lineas.push(linea);
        },
      },
    );
    const valido = Object.assign(
      new Error(JSON.stringify({ mensaje: 'Sin existencia.', detalles: [1] })),
      { number: 50301 },
    );
    const { conexion } = conexionFalsa(() => Promise.reject(valido));
    const { ejecutarSP } = crearEjecutorSP({
      conexion,
      logger: loggerEnMemoria,
      esperar: sinEspera,
    });

    await ejecutarSP('SP_Pruebas_Fallar').catch(() => undefined);

    expect(lineas).toEqual([]);
  });

  // Prueba de tipos: la verifica `pnpm typecheck`, no la ejecución.
  it('su firma solo acepta nombres SP_Modulo_Proceso, nunca texto SQL', () => {
    expectTypeOf<Parameters<EjecutorSP['ejecutarSP']>[0]>().toEqualTypeOf<NombreSP>();
    expectTypeOf<'SP_Sistema_Health'>().toExtend<NombreSP>();
    expectTypeOf<'dbo.Pedido'>().not.toExtend<NombreSP>();
    expectTypeOf<'SP_SinProceso'>().not.toExtend<NombreSP>();
  });
});

describe('montos como parámetros (A-21)', () => {
  it('un parámetro Decimal llega al driver como number, en el borde de ejecutarSP', async () => {
    const { conexion, ejecutar } = conexionFalsa(() => Promise.resolve([[]]));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await ejecutarSP('SP_Pruebas_Leer', {
      Monto: { tipo: sql.Decimal(12, 2), valor: new Decimal('149.90') },
    });

    expect(valores(ejecutar.mock.calls[0]?.[1])).toMatchObject({ Monto: 149.9 });
  });

  it('un parámetro Decimal fuera de rango falla antes de llamar a la base', async () => {
    const { conexion, ejecutar } = conexionFalsa(() => Promise.resolve([[]]));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await expect(
      ejecutarSP('SP_Pruebas_Leer', {
        Monto: { tipo: sql.Decimal(15, 2), valor: new Decimal('1e13') },
      }),
    ).rejects.toThrow(/A-21/);
    expect(ejecutar).not.toHaveBeenCalled();
  });
});
