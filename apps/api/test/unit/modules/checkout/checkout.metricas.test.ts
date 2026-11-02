import { describe, expect, it } from 'vitest';
import { conMetricasDePago } from '../../../../src/modules/checkout/checkout.metricas.js';
import type { PagoService, SolicitudPago } from '../../../../src/modules/checkout/checkout.pago.js';
import { AppError } from '../../../../src/shared/errors/index.js';
import { usarTelemetriaEnMemoria } from '../../telemetria-en-memoria.js';

const telemetria = usarTelemetriaEnMemoria();

type PagoRealizado = Awaited<ReturnType<PagoService['pagar']>>;

const SOLICITUD = {} as SolicitudPago;
const pedido = (creado: boolean) => ({ pedido: {}, creado }) as PagoRealizado;

describe('métricas del pago (E9-H01)', () => {
  it('cuenta los pedidos creados y el resultado de cada pago, también los rechazos', async () => {
    const resultados: (() => Promise<PagoRealizado>)[] = [
      () => Promise.resolve(pedido(true)),
      () => Promise.resolve(pedido(true)),
      () => Promise.resolve(pedido(false)),
      () => Promise.reject(new AppError('PAGO_RECHAZADO')),
      () => Promise.reject(new Error('inesperado')),
    ];
    const pago = conMetricasDePago({
      pagar: () => {
        const siguiente = resultados.shift();
        if (siguiente === undefined) throw new Error('Sin más resultados');
        return siguiente();
      },
    });

    for (let i = 0; i < 5; i++) await pago.pagar(SOLICITUD).catch(() => undefined);

    const metricas = await telemetria.metricas();
    expect(metricas.get('shopcart.pedidos.creados')?.[0]?.valor).toBe(2);
    expect(
      Object.fromEntries(
        (metricas.get('shopcart.pagos') ?? []).map((p) => [p.atributos.resultado, p.valor]),
      ),
    ).toEqual({ PedidoCreado: 2, Repetido: 1, PAGO_RECHAZADO: 1, ERROR_INTERNO: 1 });
  });

  it('devuelve el mismo resultado y propaga el mismo error', async () => {
    const realizado = pedido(true);
    const error = new AppError('PAGO_EN_CURSO');

    await expect(
      conMetricasDePago({ pagar: () => Promise.resolve(realizado) }).pagar(SOLICITUD),
    ).resolves.toBe(realizado);
    await expect(
      conMetricasDePago({ pagar: () => Promise.reject(error) }).pagar(SOLICITUD),
    ).rejects.toBe(error);
  });
});
