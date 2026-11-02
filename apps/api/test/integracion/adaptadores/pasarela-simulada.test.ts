import { randomUUID } from 'node:crypto';
import { Decimal } from 'decimal.js';
import sql from 'mssql';
import { describe, expect, it } from 'vitest';
import { crearPasarelaSimulada } from '../../../src/shared/adapters/pasarela-simulada.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { PasarelaSinRespuesta, type TarjetaPago } from '../../../src/shared/pasarela/index.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';

usarBaseDePruebas();

const tarjeta = (numero: string): TarjetaPago => ({
  numero,
  mesVencimiento: 12,
  anioVencimiento: 2030,
  cvv: '731',
});
const APROBADA = tarjeta('4242424242424242');
const RECHAZADA = tarjeta('4000000000000002');
const TIEMPO_AGOTADO = tarjeta('4000000000000119');
const MONTO = new Decimal('135.00');

describe('pasarela simulada (E5-H02, N-03)', () => {
  it('autoriza la tarjeta 4242 con su marca y últimos 4, y la misma llave devuelve la misma respuesta', async () => {
    const pasarela = crearPasarelaSimulada();
    const llave = randomUUID();

    const primera = await pasarela.autorizar({ llave, monto: MONTO, tarjeta: APROBADA });
    const segunda = await pasarela.autorizar({ llave, monto: MONTO, tarjeta: APROBADA });

    expect(primera).toMatchObject({ tipo: 'Autorizada', marca: 'Visa', ultimosDigitos: '4242' });
    expect(segunda).toEqual(primera);
  });

  it('rechaza la tarjeta 0002 por fondos insuficientes, también con la misma llave', async () => {
    const pasarela = crearPasarelaSimulada();
    const llave = randomUUID();

    const primera = await pasarela.autorizar({ llave, monto: MONTO, tarjeta: RECHAZADA });
    const segunda = await pasarela.autorizar({ llave, monto: MONTO, tarjeta: RECHAZADA });

    expect(primera).toMatchObject({ tipo: 'Rechazada', codigo: 'FONDOS_INSUFICIENTES' });
    expect(segunda).toEqual(primera);
  });

  it('0119 autoriza y pierde la respuesta; el reintento en otra réplica recibe la misma autorización', async () => {
    const replica1 = crearPasarelaSimulada();
    const replica2 = crearPasarelaSimulada();
    const llave = randomUUID();

    const perdida = await replica1
      .autorizar({ llave, monto: MONTO, tarjeta: TIEMPO_AGOTADO })
      .catch((error: unknown) => error);
    const reintento = await replica2.autorizar({ llave, monto: MONTO, tarjeta: TIEMPO_AGOTADO });
    const consulta = await replica1.consultar(llave);

    expect(perdida).toBeInstanceOf(PasarelaSinRespuesta);
    expect(reintento.tipo).toBe('Autorizada');
    expect(consulta).toMatchObject({
      estado: 'Autorizada',
      idTransaccion: reintento.tipo === 'Autorizada' ? reintento.idTransaccion : '',
    });
  });

  it('consultar: NoExiste, Autorizada, Capturada y Anulada', async () => {
    const pasarela = crearPasarelaSimulada();
    const [capturar, anular] = [randomUUID(), randomUUID()];
    const a = await pasarela.autorizar({ llave: capturar, monto: MONTO, tarjeta: APROBADA });
    const b = await pasarela.autorizar({ llave: anular, monto: MONTO, tarjeta: APROBADA });
    if (a.tipo !== 'Autorizada' || b.tipo !== 'Autorizada') throw new Error('Debían autorizarse');

    const antes = await pasarela.consultar(capturar);
    await pasarela.capturar(a.idTransaccion);
    await pasarela.capturar(a.idTransaccion);
    await pasarela.anular(b.idTransaccion);
    await pasarela.anular(b.idTransaccion);

    expect([
      (await pasarela.consultar(randomUUID())).estado,
      antes.estado,
      (await pasarela.consultar(capturar)).estado,
      (await pasarela.consultar(anular)).estado,
    ]).toEqual(['NoExiste', 'Autorizada', 'Capturada', 'Anulada']);
  });

  it('una autorización capturada no se anula, y una anulada no se captura', async () => {
    const pasarela = crearPasarelaSimulada();
    const a = await pasarela.autorizar({ llave: randomUUID(), monto: MONTO, tarjeta: APROBADA });
    const b = await pasarela.autorizar({ llave: randomUUID(), monto: MONTO, tarjeta: APROBADA });
    if (a.tipo !== 'Autorizada' || b.tipo !== 'Autorizada') throw new Error('Debían autorizarse');
    await pasarela.capturar(a.idTransaccion);
    await pasarela.anular(b.idTransaccion);

    await expect(pasarela.anular(a.idTransaccion)).rejects.toThrow();
    await expect(pasarela.capturar(b.idTransaccion)).rejects.toThrow();
  });

  it('reembolsa lo capturado, idempotente por llave, y nunca más de lo capturado', async () => {
    const pasarela = crearPasarelaSimulada();
    const a = await pasarela.autorizar({ llave: randomUUID(), monto: MONTO, tarjeta: APROBADA });
    if (a.tipo !== 'Autorizada') throw new Error('Debía autorizarse');
    await pasarela.capturar(a.idTransaccion);
    const llave = randomUUID();

    const primero = await pasarela.reembolsar({
      llave,
      idTransaccion: a.idTransaccion,
      monto: new Decimal('100'),
    });
    const repetido = await pasarela.reembolsar({
      llave,
      idTransaccion: a.idTransaccion,
      monto: new Decimal('100'),
    });
    const excedido = pasarela.reembolsar({
      llave: randomUUID(),
      idTransaccion: a.idTransaccion,
      monto: new Decimal('35.01'),
    });

    expect(repetido).toEqual(primero);
    await expect(excedido).rejects.toThrow();
  });

  it('nunca guarda el número completo de la tarjeta ni el CVV', async () => {
    const pasarela = crearPasarelaSimulada();
    const llave = randomUUID();
    await pasarela.autorizar({ llave, monto: MONTO, tarjeta: APROBADA });

    const [fila] = await ejecutarSP<Record<string, unknown>>('SP_Pruebas_LeerPasarela', {
      LlaveIdempotencia: { tipo: sql.UniqueIdentifier, valor: llave },
    });
    const guardado = Object.fromEntries(
      Object.entries(fila ?? {}).filter(
        ([columna]) => !['IDTransaccion', 'LlaveIdempotencia'].includes(columna),
      ),
    );

    expect(JSON.stringify(fila)).not.toContain(APROBADA.numero);
    expect(Object.values(guardado).map(String)).not.toContain(APROBADA.cvv);
    expect(guardado).toMatchObject({ UltimosDigitos: '4242', Marca: 'Visa' });
  });
});

describe('contrato completo del puerto (cierre de E5)', () => {
  it('la misma llave con otro monto o con otra tarjeta es otra solicitud y se rechaza', async () => {
    const pasarela = crearPasarelaSimulada();
    const llave = randomUUID();
    await pasarela.autorizar({ llave, monto: MONTO, tarjeta: APROBADA });

    // Cada promesa se crea dentro de su expect: una que rechaza sin esperarse sería un rechazo sin manejar.
    await expect(
      pasarela.autorizar({ llave, monto: new Decimal('1.00'), tarjeta: APROBADA }),
    ).rejects.toMatchObject({ codigo: 'LLAVE_REUTILIZADA' });
    await expect(
      pasarela.autorizar({ llave, monto: MONTO, tarjeta: RECHAZADA }),
    ).rejects.toMatchObject({ codigo: 'LLAVE_REUTILIZADA' });
  });

  it('el reembolso con la misma llave y otro monto u otra transacción se rechaza', async () => {
    const pasarela = crearPasarelaSimulada();
    const capturada = async () => {
      const autorizacion = await pasarela.autorizar({
        llave: randomUUID(),
        monto: MONTO,
        tarjeta: APROBADA,
      });
      if (autorizacion.tipo !== 'Autorizada') throw new Error('Debía autorizar');
      await pasarela.capturar(autorizacion.idTransaccion);
      return autorizacion.idTransaccion;
    };
    const [idTransaccion, otraTransaccion] = [await capturada(), await capturada()];
    const llave = randomUUID();
    const primero = await pasarela.reembolsar({
      llave,
      idTransaccion,
      monto: new Decimal('10.00'),
    });

    const repetido = await pasarela.reembolsar({
      llave,
      idTransaccion,
      monto: new Decimal('10.00'),
    });

    expect(repetido).toEqual(primero);
    await expect(
      pasarela.reembolsar({ llave, idTransaccion, monto: new Decimal('20.00') }),
    ).rejects.toMatchObject({ codigo: 'LLAVE_REUTILIZADA' });
    await expect(
      pasarela.reembolsar({ llave, idTransaccion: otraTransaccion, monto: new Decimal('10.00') }),
    ).rejects.toMatchObject({ codigo: 'LLAVE_REUTILIZADA' });
  });

  it('declina una tarjeta vencida según su reloj (vale hasta el último día de su mes)', async () => {
    const pasarela = crearPasarelaSimulada({ ahora: () => new Date('2026-11-01T00:00:00Z') });
    const vencida = { ...APROBADA, mesVencimiento: 10, anioVencimiento: 2026 };
    const vigente = { ...APROBADA, mesVencimiento: 11, anioVencimiento: 2026 };

    const declinada = await pasarela.autorizar({
      llave: randomUUID(),
      monto: MONTO,
      tarjeta: vencida,
    });
    const aceptada = await pasarela.autorizar({
      llave: randomUUID(),
      monto: MONTO,
      tarjeta: vigente,
    });

    expect(declinada).toMatchObject({ tipo: 'Rechazada', codigo: 'TARJETA_VENCIDA' });
    expect(aceptada.tipo).toBe('Autorizada');
  });
});
