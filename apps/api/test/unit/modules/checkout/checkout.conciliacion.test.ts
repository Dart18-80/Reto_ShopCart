import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { crearConciliacionService } from '../../../../src/modules/checkout/checkout.conciliacion.js';
import type {
  IntentoPorConciliar,
  ResolucionConciliada,
  TomaConciliacion,
} from '../../../../src/modules/checkout/checkout.types.js';
import type { EstadoEnPasarela } from '../../../../src/shared/pasarela/index.js';

const TARJETA = { marca: 'Visa', ultimosDigitos: '4242' };
const PENDIENTE: IntentoPorConciliar = {
  idIntento: 1,
  estado: 'Pendiente',
  llave: 'llave-1',
  idTransaccion: null,
  idPedido: null,
  token: 'token-c',
};
const AUTORIZADO: IntentoPorConciliar = {
  idIntento: 2,
  estado: 'Autorizado',
  llave: 'llave-2',
  idTransaccion: 'txn-2',
  idPedido: null,
  token: 'token-c',
};

/** La conciliación toma los intentos dados, uno por llamada, y después ninguno. */
function preparar(intentos: IntentoPorConciliar[], enPasarela?: EstadoEnPasarela) {
  const tomas: TomaConciliacion[] = intentos.map((intento) => ({ ejecutada: true, intento }));
  const repositorio = {
    tomarIntentoPorConciliar: vi.fn((): Promise<TomaConciliacion> =>
      Promise.resolve(tomas.shift() ?? { ejecutada: true, intento: null }),
    ),
    resolverIntentoConciliado: vi.fn(
      (_intento: IntentoPorConciliar, _resolucion: ResolucionConciliada) => Promise.resolve(true),
    ),
  };
  const pasarela = {
    autorizar: vi.fn(() => Promise.reject(new Error('no se usa'))),
    capturar: vi.fn(() => Promise.resolve()),
    anular: vi.fn(() => Promise.resolve()),
    reembolsar: vi.fn(() => Promise.reject(new Error('no se usa'))),
    consultar: vi.fn(() => Promise.resolve(enPasarela ?? { estado: 'NoExiste' as const })),
  };
  const servicio = crearConciliacionService({
    repositorio,
    pasarela,
    logger: pino({ level: 'silent' }),
  });
  return { servicio, repositorio, pasarela };
}

const resoluciones = (repositorio: ReturnType<typeof preparar>['repositorio']) =>
  repositorio.resolverIntentoConciliado.mock.calls.map(([, resolucion]) => resolucion);

describe('checkout.conciliacion (E5-H04, N-03)', () => {
  it('toma los intentos con 2 minutos de gracia y los arrienda lo que tardan sus dos llamadas a la pasarela, con holgura', async () => {
    const { servicio, repositorio } = preparar([]);

    await servicio.conciliar();

    expect(repositorio.tomarIntentoPorConciliar).toHaveBeenCalledWith(120, 60);
  });

  it('Pendiente que la pasarela no conoce → Fallido, sin capturar ni anular', async () => {
    const { servicio, repositorio, pasarela } = preparar([PENDIENTE], { estado: 'NoExiste' });

    const resultado = await servicio.conciliar();

    expect(pasarela.consultar).toHaveBeenCalledWith('llave-1');
    expect(resoluciones(repositorio)).toEqual([{ estado: 'Fallido' }]);
    expect(pasarela.anular).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ Fallido: 1 });
  });

  it('Pendiente rechazado en la pasarela → Rechazado con su código y mensaje', async () => {
    const { servicio, repositorio } = preparar([PENDIENTE], {
      estado: 'Rechazada',
      codigo: 'FONDOS_INSUFICIENTES',
      mensaje: 'Fondos insuficientes.',
      ...TARJETA,
    });

    await servicio.conciliar();

    expect(resoluciones(repositorio)).toEqual([
      { estado: 'Rechazado', codigo: 'FONDOS_INSUFICIENTES', mensaje: 'Fondos insuficientes.' },
    ]);
  });

  it('Pendiente autorizado sin pedido → anula la autorización', async () => {
    const { servicio, repositorio, pasarela } = preparar([PENDIENTE], {
      estado: 'Autorizada',
      idTransaccion: 'txn-1',
      ...TARJETA,
    });

    await servicio.conciliar();

    expect(pasarela.anular).toHaveBeenCalledWith('txn-1');
    expect(resoluciones(repositorio)).toEqual([{ estado: 'Anulado', idTransaccion: 'txn-1' }]);
  });

  it('Pendiente ya anulado en la pasarela → Anulado sin volver a anular', async () => {
    const { servicio, repositorio, pasarela } = preparar([PENDIENTE], {
      estado: 'Anulada',
      idTransaccion: 'txn-1',
      ...TARJETA,
    });

    await servicio.conciliar();

    expect(pasarela.anular).not.toHaveBeenCalled();
    expect(resoluciones(repositorio)).toEqual([{ estado: 'Anulado', idTransaccion: 'txn-1' }]);
  });

  it('Autorizado con pedido → captura sin consultar', async () => {
    const { servicio, repositorio, pasarela } = preparar([{ ...AUTORIZADO, idPedido: 9 }]);

    await servicio.conciliar();

    expect(pasarela.consultar).not.toHaveBeenCalled();
    expect(pasarela.capturar).toHaveBeenCalledWith('txn-2');
    expect(resoluciones(repositorio)).toEqual([{ estado: 'Capturado', idTransaccion: 'txn-2' }]);
  });

  it('Autorizado sin pedido → anula', async () => {
    const { servicio, repositorio, pasarela } = preparar([AUTORIZADO]);

    await servicio.conciliar();

    expect(pasarela.anular).toHaveBeenCalledWith('txn-2');
    expect(resoluciones(repositorio)).toEqual([{ estado: 'Anulado', idTransaccion: 'txn-2' }]);
  });

  it('si falla uno, lo cuenta como error y sigue con el siguiente', async () => {
    const { servicio, pasarela } = preparar([{ ...AUTORIZADO, idPedido: 9 }, AUTORIZADO]);
    pasarela.capturar.mockRejectedValueOnce(new Error('pasarela caída'));

    const resultado = await servicio.conciliar();

    expect(resultado).toMatchObject({ errores: 1, Anulado: 1 });
  });

  it('si otra petición ya lo resolvió, lo cuenta como SinCambio y no como resuelto', async () => {
    const { servicio, repositorio } = preparar([AUTORIZADO]);
    repositorio.resolverIntentoConciliado.mockResolvedValueOnce(false);

    const resultado = await servicio.conciliar();

    expect(resultado).toMatchObject({ Anulado: 0, SinCambio: 1 });
  });

  it('si la otra réplica tiene el bloqueo, no hace nada (null)', async () => {
    const { servicio, repositorio } = preparar([]);
    repositorio.tomarIntentoPorConciliar.mockResolvedValueOnce({ ejecutada: false });

    expect(await servicio.conciliar()).toBeNull();
  });

  it('una ejecución toma como máximo 50 intentos', async () => {
    const { servicio, repositorio } = preparar(Array.from({ length: 60 }, () => AUTORIZADO));

    await servicio.conciliar();

    expect(repositorio.tomarIntentoPorConciliar).toHaveBeenCalledTimes(50);
  });
});
