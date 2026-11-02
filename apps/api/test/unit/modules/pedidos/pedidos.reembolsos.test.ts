import { Decimal } from 'decimal.js';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { crearReembolsosService } from '../../../../src/modules/pedidos/pedidos.reembolsos.js';
import type {
  EstadoReembolso,
  Pedido,
  ReembolsoParaProcesar,
  ResultadoReembolso,
} from '../../../../src/modules/pedidos/pedidos.types.js';
import type { EstadoEnPasarela } from '../../../../src/shared/pasarela/index.js';

const TARJETA = { marca: 'Visa', ultimosDigitos: '4242' };
const CANCELACION: ReembolsoParaProcesar = {
  idReembolso: 3,
  origen: 'Cancelacion',
  monto: new Decimal('135.00'),
  llave: 'llave-reembolso',
  idTransaccion: 'txn-1',
  llaveIntento: 'llave-intento',
};

function preparar(tomado: ReembolsoParaProcesar | null, enPasarela: EstadoEnPasarela) {
  const repositorio = {
    cancelar: vi.fn(() => Promise.resolve(3)),
    obtener: vi.fn((): Promise<Pedido | null> => Promise.resolve(null)),
    tomarReembolso: vi.fn(() => Promise.resolve(tomado)),
    actualizarReembolso: vi.fn(
      (_id: number, resultado: ResultadoReembolso): Promise<EstadoReembolso> =>
        Promise.resolve(resultado.exito ? 'Completado' : 'Pendiente'),
    ),
    obtenerReembolsosPendientes: vi.fn((): Promise<number[] | null> => Promise.resolve([])),
    listarReembolsos: vi.fn(() => Promise.resolve({ filas: [], total: 0 })),
    reintentarReembolso: vi.fn((): Promise<EstadoReembolso | null> => Promise.resolve('Pendiente')),
  };
  const pasarela = {
    autorizar: vi.fn(() => Promise.reject(new Error('no se usa'))),
    capturar: vi.fn(() => Promise.resolve()),
    anular: vi.fn(() => Promise.resolve()),
    reembolsar: vi.fn(() => Promise.resolve({ idReembolso: 'SIMR-1' })),
    consultar: vi.fn(() => Promise.resolve(enPasarela)),
  };
  const servicio = crearReembolsosService({
    repositorio,
    pasarela,
    logger: pino({ level: 'silent' }),
  });
  return { servicio, repositorio, pasarela };
}

const resultadoDe = (repositorio: ReturnType<typeof preparar>['repositorio']) =>
  repositorio.actualizarReembolso.mock.calls[0]?.[1];

describe('pedidos.reembolsos (E6-H03, N-09)', () => {
  it('una cancelación con el cobro sin capturar anula la autorización, sin reembolsar', async () => {
    const { servicio, repositorio, pasarela } = preparar(CANCELACION, {
      estado: 'Autorizada',
      idTransaccion: 'txn-1',
      ...TARJETA,
    });

    expect(await servicio.procesar(3)).toBe('Completado');
    expect(pasarela.anular).toHaveBeenCalledWith('txn-1');
    expect(pasarela.reembolsar).not.toHaveBeenCalled();
    expect(resultadoDe(repositorio)).toEqual({ exito: true, idTransaccionReembolso: null });
  });

  it('una cancelación con el cobro capturado reembolsa con la llave fija del reembolso', async () => {
    const { servicio, repositorio, pasarela } = preparar(CANCELACION, {
      estado: 'Capturada',
      idTransaccion: 'txn-1',
      ...TARJETA,
    });

    await servicio.procesar(3);

    expect(pasarela.reembolsar).toHaveBeenCalledWith({
      llave: 'llave-reembolso',
      idTransaccion: 'txn-1',
      monto: CANCELACION.monto,
    });
    expect(resultadoDe(repositorio)).toEqual({ exito: true, idTransaccionReembolso: 'SIMR-1' });
  });

  it('una devolución reembolsa directo, sin consultar la pasarela', async () => {
    const { servicio, pasarela } = preparar(
      { ...CANCELACION, origen: 'Devolucion' },
      {
        estado: 'NoExiste',
      },
    );

    await servicio.procesar(3);

    expect(pasarela.consultar).not.toHaveBeenCalled();
    expect(pasarela.reembolsar).toHaveBeenCalledTimes(1);
  });

  it('si la pasarela falla, registra el fallo con su mensaje (el reembolso queda para reintentar)', async () => {
    const { servicio, repositorio, pasarela } = preparar(CANCELACION, {
      estado: 'Capturada',
      idTransaccion: 'txn-1',
      ...TARJETA,
    });
    pasarela.reembolsar.mockRejectedValueOnce(new Error('pasarela caída'));

    expect(await servicio.procesar(3)).toBe('Pendiente');
    expect(resultadoDe(repositorio)).toEqual({ exito: false, error: 'pasarela caída' });
  });

  it('si el reembolso no está Pendiente o lo tiene otro proceso, no toca la pasarela', async () => {
    const { servicio, repositorio, pasarela } = preparar(null, { estado: 'NoExiste' });

    expect(await servicio.procesar(3)).toBeNull();
    expect(pasarela.consultar).not.toHaveBeenCalled();
    expect(repositorio.actualizarReembolso).not.toHaveBeenCalled();
  });

  it('el job devuelve null si la otra réplica tiene el bloqueo', async () => {
    const { servicio, repositorio } = preparar(null, { estado: 'NoExiste' });
    repositorio.obtenerReembolsosPendientes.mockResolvedValueOnce(null);

    expect(await servicio.reintentarPendientes()).toBeNull();
  });
});
