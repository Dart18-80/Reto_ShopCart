import { describe, expect, it } from 'vitest';
import { AppError } from '../../../../src/shared/errors/app-error.js';
import { traducirErrorSql } from '../../../../src/shared/errors/traducir-sql.js';

const errorSql = (numero: number, mensaje: string): Error =>
  Object.assign(new Error(mensaje), { number: numero });

describe('traducirErrorSql', () => {
  it('convierte un THROW 50003 en PARAMETRO_INVALIDO con HTTP 400 y el mensaje del SP', () => {
    const error = traducirErrorSql(errorSql(50003, 'La página no es válida.'));

    expect(error).toBeInstanceOf(AppError);
    expect(error?.codigo).toBe('PARAMETRO_INVALIDO');
    expect(error?.status).toBe(400);
    expect(error?.message).toBe('La página no es válida.');
    expect(error?.detalles).toBeUndefined();
  });

  it('usa el HTTP del catálogo para cada código de negocio', () => {
    expect(traducirErrorSql(errorSql(50301, 'Sin existencia.'))?.status).toBe(409);
    expect(traducirErrorSql(errorSql(50604, 'Rechazado.'))?.status).toBe(402);
    expect(traducirErrorSql(errorSql(50507, 'Mínimo.'))?.status).toBe(422);
  });

  it('A-19: separa un mensaje JSON en mensaje y detalles', () => {
    const mensaje = JSON.stringify({
      mensaje: 'No hay existencia suficiente para algunos productos.',
      detalles: [{ idVariante: 7, disponible: 1 }],
    });

    const error = traducirErrorSql(errorSql(50301, mensaje));

    expect(error?.codigo).toBe('STOCK_INSUFICIENTE');
    expect(error?.message).toBe('No hay existencia suficiente para algunos productos.');
    expect(error?.detalles).toEqual([{ idVariante: 7, disponible: 1 }]);
  });

  it('no expone un JSON mal formado: usa el mensaje del catálogo', () => {
    const error = traducirErrorSql(errorSql(50301, '{ esto no es JSON'));

    expect(error?.codigo).toBe('STOCK_INSUFICIENTE');
    expect(error?.message).not.toContain('{');
  });

  it('un número de negocio fuera del catálogo se trata como error interno', () => {
    const error = traducirErrorSql(errorSql(50999, 'Mensaje sin catalogar.'));

    expect(error?.codigo).toBe('ERROR_INTERNO');
    expect(error?.status).toBe(500);
    expect(error?.message).not.toBe('Mensaje sin catalogar.');
  });

  it('no traduce errores de SQL Server que no son de negocio ni errores comunes', () => {
    expect(traducirErrorSql(errorSql(1205, 'Deadlock.'))).toBeUndefined();
    expect(traducirErrorSql(errorSql(229, 'Permiso denegado.'))).toBeUndefined();
    expect(traducirErrorSql(new Error('Otro error'))).toBeUndefined();
    expect(traducirErrorSql('texto')).toBeUndefined();
  });
});
