import { Decimal } from 'decimal.js';
import sql from 'mssql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { aMonto } from '../../../src/shared/dinero/index.js';
import { conectarBaseDePruebas } from '../base-de-pruebas.js';
import { unaFila } from '../datos-de-prueba.js';

interface FilaMonto {
  Monto: number;
  Promedio: number;
}

let pool: sql.ConnectionPool | undefined;

beforeAll(async () => {
  pool = await conectarBaseDePruebas();
});

afterAll(async () => {
  await pool?.close();
});

function ecoMonto(monto: Decimal): Promise<FilaMonto> {
  return unaFila<FilaMonto>('SP_Pruebas_EcoMonto', {
    Monto: { tipo: sql.Decimal(12, 2), valor: monto },
  });
}

describe('montos de ida y vuelta por SQL Server (A-21)', () => {
  it.each(['0.01', '0.10', '149.90', '9999999999.99'])(
    '%s llega al SP y vuelve sin perder un centavo',
    async (texto) => {
      const fila = await ecoMonto(new Decimal(texto));

      expect(aMonto(fila.Monto).toFixed(2)).toBe(texto);
    },
  );

  it('un AVG con decimales periódicos convertido a DECIMAL(15,2) en el SP llega como 1.67', async () => {
    const fila = await ecoMonto(new Decimal('0'));

    expect(aMonto(fila.Promedio).toFixed(2)).toBe('1.67');
  });
});
