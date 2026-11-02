import pino, { type Logger } from 'pino';
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

const CON_PEDIDO: IntentoPorConciliar = { ...AUTORIZADO, idPedido: 9 };
const AUTORIZADA_2: EstadoEnPasarela = { estado: 'Autorizada', idTransaccion: 'txn-2', ...TARJETA };

/** La conciliación toma los intentos dados, uno por llamada, y después ninguno. */
function preparar(
  intentos: IntentoPorConciliar[],
  enPasarela?: EstadoEnPasarela,
  logger: Logger = pino({ level: 'silent' }),
) {
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
    logger,
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

  it('Autorizado con pedido y autorizado en la pasarela → consulta y captura', async () => {
    const { servicio, repositorio, pasarela } = preparar([CON_PEDIDO], AUTORIZADA_2);

    await servicio.conciliar();

    expect(pasarela.consultar).toHaveBeenCalledWith('llave-2');
    expect(pasarela.capturar).toHaveBeenCalledWith('txn-2');
    expect(resoluciones(repositorio)).toEqual([{ estado: 'Capturado', idTransaccion: 'txn-2' }]);
  });

  it.each([
    ['anulada', { estado: 'Anulada' as const, idTransaccion: 'txn-2', ...TARJETA }],
    ['desconocida', { estado: 'NoExiste' as const }],
  ])(
    'Autorizado con pedido y la autorización %s en la pasarela → EnRevision, una vez y con log de error, sin capturar',
    async (_caso, enPasarela) => {
      const registrado: string[] = [];
      const logger = pino({ level: 'error' }, { write: (linea: string) => registrado.push(linea) });
      const { servicio, repositorio, pasarela } = preparar([CON_PEDIDO], enPasarela, logger);

      const resultado = await servicio.conciliar();

      expect(pasarela.capturar).not.toHaveBeenCalled();
      expect(pasarela.anular).not.toHaveBeenCalled();
      expect(resoluciones(repositorio)).toEqual([{ estado: 'EnRevision' }]);
      expect(resultado).toMatchObject({ EnRevision: 1, errores: 0 });
      expect(registrado).toHaveLength(1);
      expect(registrado[0]).toContain('EnRevision');
    },
  );

  it('un cobro Capturado sin pedido → EnRevision, sin anular ni capturar (no reintenta para siempre)', async () => {
    const { servicio, repositorio, pasarela } = preparar([PENDIENTE], {
      estado: 'Capturada',
      idTransaccion: 'txn-1',
      ...TARJETA,
    });

    const resultado = await servicio.conciliar();

    expect(resoluciones(repositorio)).toEqual([{ estado: 'EnRevision' }]);
    expect(pasarela.anular).not.toHaveBeenCalled();
    expect(pasarela.capturar).not.toHaveBeenCalled();
    expect(resultado).toMatchObject({ EnRevision: 1, errores: 0 });
  });

  it('Autorizado sin pedido → anula', async () => {
    const { servicio, repositorio, pasarela } = preparar([AUTORIZADO]);

    await servicio.conciliar();

    expect(pasarela.anular).toHaveBeenCalledWith('txn-2');
    expect(resoluciones(repositorio)).toEqual([{ estado: 'Anulado', idTransaccion: 'txn-2' }]);
  });

  it('si falla uno, lo cuenta como error y sigue con el siguiente', async () => {
    const { servicio, pasarela } = preparar([CON_PEDIDO, AUTORIZADO], AUTORIZADA_2);
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
