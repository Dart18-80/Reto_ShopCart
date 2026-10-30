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

  it('fuera de una petición (jobs) envía los parámetros estándar en NULL', async () => {
    const { conexion, ejecutar } = conexionFalsa(() => Promise.resolve([[]]));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await ejecutarSP('SP_Pruebas_Leer');

    expect(valores(ejecutar.mock.calls[0]?.[1])).toEqual({
      IDUsuarioActor: null,
      RolActor: null,
      RequestId: null,
    });
  });

  it('RF-01: rechaza que el llamador envíe un parámetro estándar', async () => {
    const { conexion, ejecutar } = conexionFalsa(() => Promise.resolve([[]]));
    const { ejecutarSP } = crearEjecutorSP({ conexion, logger, esperar: sinEspera });

    await expect(
      ejecutarSP('SP_Pruebas_Leer', { IDUsuarioActor: { tipo: sql.Int, valor: 99 } }),
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

  // Prueba de tipos: la verifica `pnpm typecheck`, no la ejecución.
  it('su firma solo acepta nombres SP_Modulo_Proceso, nunca texto SQL', () => {
    expectTypeOf<Parameters<EjecutorSP['ejecutarSP']>[0]>().toEqualTypeOf<NombreSP>();
    expectTypeOf<'SP_Sistema_Health'>().toExtend<NombreSP>();
    expectTypeOf<'dbo.Pedido'>().not.toExtend<NombreSP>();
    expectTypeOf<'SP_SinProceso'>().not.toExtend<NombreSP>();
  });
});
