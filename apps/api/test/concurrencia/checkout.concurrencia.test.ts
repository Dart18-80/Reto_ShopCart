import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  api,
  clientesSembrados,
  comprar,
  datos,
  error,
  existenciaDe,
  limpiarCarritos,
  metodoEstandar,
  tokenDeAdmin,
  TOTAL_CLIENTES,
  varianteConExistencia,
  type Cliente,
  type Intento,
} from './apoyo-concurrencia.js';

// RNF-3: 20 clientes compiten a la vez por la última unidad o por el último uso de un cupón, a través de
// nginx (round-robin entre api-1 y api-2). Requiere `docker compose up -d`.

let tokenAdmin: string;
let idMetodoEnvio: number;
let clientes: Cliente[];

beforeAll(async () => {
  tokenAdmin = await tokenDeAdmin();
  idMetodoEnvio = await metodoEstandar();
  clientes = await clientesSembrados();
});

beforeEach(() => limpiarCarritos(clientes));

const agregar = (cliente: Cliente, idVariante: number) =>
  api('POST', '/carrito/lineas', { token: cliente.token, cuerpo: { idVariante, cantidad: 1 } });

/** Los 20 a la vez: Promise.all dispara todas las peticiones en el mismo turno del event loop. */
const comprarTodosALaVez = (): Promise<Intento[]> =>
  Promise.all(clientes.map((cliente) => comprar(cliente, idMetodoEnvio)));

const exitos = (intentos: Intento[]) => intentos.filter(({ final }) => final.status === 201);
const rechazos = (intentos: Intento[], status: number, codigo: string) =>
  intentos.filter(({ final }) => final.status === status && error(final)?.codigo === codigo);
const instancias = (intentos: Intento[]) => new Set(intentos.flatMap((i) => i.instancias));

async function conciliacionDeInventario(): Promise<unknown[]> {
  return datos(
    await api('GET', '/inventario/conciliacion', { token: tokenAdmin }),
    z.array(z.unknown()),
  );
}

describe('concurrencia del checkout (E5-H05, RNF-3)', () => {
  it('escenario 1: 20 clientes por la última unidad → 1 pedido y 19 × 409 STOCK_INSUFICIENTE', async () => {
    const variante = await varianteConExistencia(tokenAdmin, 1);
    for (const cliente of clientes) {
      expect([200, 201]).toContain((await agregar(cliente, variante.idVariante)).status);
    }

    const intentos = await comprarTodosALaVez();

    expect(exitos(intentos)).toHaveLength(1);
    const sinStock = rechazos(intentos, 409, 'STOCK_INSUFICIENTE');
    expect(sinStock).toHaveLength(TOTAL_CLIENTES - 1);
    for (const { final } of sinStock) {
      expect(error(final)?.mensaje).toMatch(/existencia/i);
    }
    expect(await existenciaDe(tokenAdmin, variante)).toMatchObject({
      existenciaFisica: 0,
      disponible: 0,
    });
    expect(await conciliacionDeInventario()).toEqual([]);
    expect(instancias(intentos)).toEqual(new Set(['api-1', 'api-2']));
  });

  it('escenario 2: 20 clientes por el último uso de un cupón → 1 pedido con cupón y 19 × 422 CUPON_AGOTADO', async () => {
    const variante = await varianteConExistencia(tokenAdmin, TOTAL_CLIENTES);
    const codigo = `CONC${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
    const { idCupon } = datos(
      await api('POST', '/admin/cupones', {
        token: tokenAdmin,
        cuerpo: {
          codigo,
          descripcion: 'Cupón de la prueba de concurrencia',
          tipo: 'MontoFijo',
          valor: '5.00',
          fechaInicio: new Date(Date.now() - 60_000).toISOString(),
          fechaFin: new Date(Date.now() + 3_600_000).toISOString(),
          limiteUsosTotal: 1,
        },
      }),
      z.object({ idCupon: z.number() }),
    );
    for (const cliente of clientes) {
      expect([200, 201]).toContain((await agregar(cliente, variante.idVariante)).status);
      const aplicado = await api('PUT', '/carrito/cupon', {
        token: cliente.token,
        cuerpo: { codigo },
      });
      expect(aplicado.status).toBe(200);
    }

    const intentos = await comprarTodosALaVez();

    expect(exitos(intentos)).toHaveLength(1);
    const [pedido] = exitos(intentos);
    if (pedido === undefined) throw new Error('Ningún pago se completó');
    expect(datos(pedido.final, z.object({ codigoCupon: z.string() }))).toEqual({
      codigoCupon: codigo,
    });
    expect(rechazos(intentos, 422, 'CUPON_AGOTADO')).toHaveLength(TOTAL_CLIENTES - 1);
    expect(
      datos(
        await api('GET', `/admin/cupones/${String(idCupon)}`, { token: tokenAdmin }),
        z.object({ usosComprometidos: z.number(), limiteUsosTotal: z.number() }),
      ),
    ).toEqual({ usosComprometidos: 1, limiteUsosTotal: 1 });
    expect(instancias(intentos)).toEqual(new Set(['api-1', 'api-2']));
  });
});
