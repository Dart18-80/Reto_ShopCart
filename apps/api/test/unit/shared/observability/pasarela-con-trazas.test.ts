import { SpanStatusCode } from '@opentelemetry/api';
import { Decimal } from 'decimal.js';
import { describe, expect, it } from 'vitest';
import { conTrazas } from '../../../../src/shared/observability/pasarela-con-trazas.js';
import { PasarelaSinRespuesta, type PasarelaPago } from '../../../../src/shared/pasarela/index.js';
import { usarTelemetriaEnMemoria } from '../../telemetria-en-memoria.js';

const telemetria = usarTelemetriaEnMemoria();

const TARJETA = {
  numero: '4242424242424242',
  mesVencimiento: 12,
  anioVencimiento: 2030,
  cvv: '123',
};

const pasarelaFalsa: PasarelaPago = {
  autorizar: () =>
    Promise.resolve({
      tipo: 'Autorizada',
      idTransaccion: 'tx-1',
      marca: 'Visa',
      ultimosDigitos: '4242',
    }),
  capturar: () => Promise.resolve(),
  anular: () => Promise.reject(new PasarelaSinRespuesta('anular')),
  reembolsar: () => Promise.resolve({ idReembolso: 'r-1' }),
  consultar: () => Promise.resolve({ estado: 'NoExiste' }),
};

describe('pasarela con trazas (E9-H01)', () => {
  it('cada operación es un span propio con su resultado', async () => {
    const pasarela = conTrazas(pasarelaFalsa);

    await pasarela.autorizar({ llave: 'llave-1', monto: new Decimal('10.00'), tarjeta: TARJETA });
    await pasarela.capturar('tx-1');
    await pasarela.reembolsar({
      llave: 'llave-2',
      idTransaccion: 'tx-1',
      monto: new Decimal('5.00'),
    });
    await pasarela.consultar('llave-1');

    expect(
      telemetria.spans().map((s) => [s.name, s.attributes['shopcart.pasarela.resultado']]),
    ).toEqual([
      ['pasarela.autorizar', 'Autorizada'],
      ['pasarela.capturar', 'Ok'],
      ['pasarela.reembolsar', 'Ok'],
      ['pasarela.consultar', 'NoExiste'],
    ]);
  });

  it('una pasarela que no responde deja el span en error y propaga el mismo error', async () => {
    const pasarela = conTrazas(pasarelaFalsa);

    await expect(pasarela.anular('tx-1')).rejects.toBeInstanceOf(PasarelaSinRespuesta);

    const [span] = telemetria.spans();
    expect(span?.name).toBe('pasarela.anular');
    expect(span?.status.code).toBe(SpanStatusCode.ERROR);
  });

  it('nunca lleva la tarjeta: ni el número, ni el CVV, ni el vencimiento', async () => {
    const pasarela = conTrazas(pasarelaFalsa);

    await pasarela.autorizar({ llave: 'llave-3', monto: new Decimal('10.00'), tarjeta: TARJETA });

    const texto = JSON.stringify(telemetria.spans().map((s) => [s.attributes, s.events]));
    expect(texto).not.toContain(TARJETA.numero);
    expect(texto).not.toContain(TARJETA.cvv);
    expect(texto).not.toContain('2030');
  });
});
