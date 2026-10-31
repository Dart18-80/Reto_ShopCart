import express, { type Express } from 'express';
import sql from 'mssql';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { AppError, manejadorErrores } from '../../../src/shared/errors/index.js';
import { ejecutarConContexto, manejar, requestId } from '../../../src/shared/http/index.js';
import { leerError } from '../../unit/respuestas.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';

usarBaseDePruebas();

function lanzarError(numero: number, mensaje: string): Promise<unknown> {
  return ejecutarSP('SP_Pruebas_LanzarError', {
    Numero: { tipo: sql.Int, valor: numero },
    Mensaje: { tipo: sql.NVarChar(2048), valor: mensaje },
  }).catch((error: unknown) => error);
}

describe('mapeo de errores de SQL Server (A-06)', () => {
  it('un THROW 50003 llega como AppError PARAMETRO_INVALIDO con HTTP 400 y el mensaje del SP', async () => {
    const error = await lanzarError(50003, 'La página no es válida.');

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({
      codigo: 'PARAMETRO_INVALIDO',
      status: 400,
      message: 'La página no es válida.',
    });
  });

  it('A-19: un THROW con mensaje JSON llega separado en mensaje y detalles', async () => {
    const mensaje = JSON.stringify({
      mensaje: 'No hay existencia suficiente.',
      detalles: [{ idVariante: 7, disponible: 1 }],
    });

    const error = await lanzarError(50301, mensaje);

    expect(error).toMatchObject({
      codigo: 'STOCK_INSUFICIENTE',
      status: 409,
      message: 'No hay existencia suficiente.',
      detalles: [{ idVariante: 7, disponible: 1 }],
    });
  });
});

describe('parámetros estándar (A-18)', () => {
  it('el SP recibe @IDUsuarioActor, @RolActor y @RequestId del contexto de la petición', async () => {
    const contexto = {
      requestId: '8f1c2e9a-0000-4000-8000-000000000001',
      idUsuario: 7,
      rol: 'Cliente' as const,
    };

    const [fila] = await ejecutarConContexto(contexto, () =>
      ejecutarSP<{ IDUsuarioActor: number; RolActor: string; RequestId: string }>(
        'SP_Pruebas_EcoContexto',
      ),
    );

    expect(fila).toEqual({
      IDUsuarioActor: 7,
      RolActor: 'Cliente',
      RequestId: '8F1C2E9A-0000-4000-8000-000000000001',
    });
  });
});

describe('de punta a punta por HTTP (E0-H04)', () => {
  // Una ruta mínima con las mismas piezas que un módulo: requestId → manejar → ejecutarSP → middleware de errores.
  function appConErrorDelSp(numero: number, mensaje: string): Express {
    const app = express();
    app.use(requestId);
    app.get(
      '/error-del-sp',
      manejar({}, async () => {
        await ejecutarSP('SP_Pruebas_LanzarError', {
          Numero: { tipo: sql.Int, valor: numero },
          Mensaje: { tipo: sql.NVarChar(2048), valor: mensaje },
        });
      }),
    );
    app.use(manejadorErrores(pino({ level: 'silent' })));
    return app;
  }

  it('un THROW 50003 llega al cliente como 400 PARAMETRO_INVALIDO con el mensaje del SP y el requestId', async () => {
    const respuesta = await request(appConErrorDelSp(50003, 'La página no es válida.')).get(
      '/error-del-sp',
    );

    expect(respuesta.status).toBe(400);
    expect(leerError(respuesta)).toEqual({
      codigo: 'PARAMETRO_INVALIDO',
      mensaje: 'La página no es válida.',
      requestId: respuesta.get('X-Request-Id'),
    });
  });

  it('A-19: un THROW con JSON llega al cliente con mensaje y detalles separados', async () => {
    const mensaje = JSON.stringify({ mensaje: 'Sin existencia.', detalles: [{ idVariante: 7 }] });

    const respuesta = await request(appConErrorDelSp(50301, mensaje)).get('/error-del-sp');

    expect(respuesta.status).toBe(409);
    expect(leerError(respuesta)).toMatchObject({
      codigo: 'STOCK_INSUFICIENTE',
      mensaje: 'Sin existencia.',
      detalles: [{ idVariante: 7 }],
    });
  });
});
