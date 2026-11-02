import { Decimal } from 'decimal.js';
import pino, { type Logger } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { crearReembolsosService } from '../../../../src/modules/pedidos/pedidos.reembolsos.js';
import type {
  EstadoReembolso,
  Pedido,
  ReembolsoParaProcesar,
  ResultadoActualizacionReembolso,
  ResultadoReembolso,
} from '../../../../src/modules/pedidos/pedidos.types.js';
import type { EstadoEnPasarela } from '../../../../src/shared/pasarela/index.js';
import { invalidadorDePrueba } from '../../invalidador-de-prueba.js';

const TARJETA = { marca: 'Visa', ultimosDigitos: '4242' };
const CAPTURADA: EstadoEnPasarela = { estado: 'Capturada', idTransaccion: 'txn-1', ...TARJETA };
const CANCELACION: ReembolsoParaProcesar = {
  idReembolso: 3,
  origen: 'Cancelacion',
  monto: new Decimal('135.00'),
  llave: 'llave-reembolso',
  tokenReclamo: 'reclamo-1',
  idTransaccion: 'txn-1',
  llaveIntento: 'llave-intento',
};

function preparar(
  tomado: ReembolsoParaProcesar | null,
  enPasarela: EstadoEnPasarela,
  logger: Logger = pino({ level: 'silent' }),
) {
  const repositorio = {
    cancelar: vi.fn(() => Promise.resolve(3)),
    registrarDevolucion: vi.fn(() =>
      Promise.resolve({ idDevolucion: 1, idReembolso: 3, montoReembolso: new Decimal('10.00') }),
    ),
    obtener: vi.fn((): Promise<Pedido | null> => Promise.resolve(null)),
    tomarReembolso: vi.fn(() => Promise.resolve(tomado)),
    actualizarReembolso: vi.fn(
      (
        _reembolso: unknown,
        resultado: ResultadoReembolso,
      ): Promise<ResultadoActualizacionReembolso> =>
        Promise.resolve({ estado: resultado.exito ? 'Completado' : 'Pendiente', aplicado: true }),
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
  const { reportes, invalidaciones } = invalidadorDePrueba();
  const servicio = crearReembolsosService({
    repositorio,
    pasarela,
    logger,
    reportes,
  });
  return { servicio, repositorio, pasarela, invalidaciones };
}

const PEDIDO_CANCELADO: Pedido = {
  idPedido: 10,
  numeroPedido: 'SC-000010',
  estado: 'Cancelado',
  subtotal: new Decimal(0),
  descuento: new Decimal(0),
  costoEnvio: new Decimal(0),
  total: new Decimal(0),
  baseImponible: new Decimal(0),
  iva: new Decimal(0),
  montoReembolsado: new Decimal(0),
  codigoCupon: null,
  envio: { nombre: 'Estándar', fechaEstimadaEntrega: '2026-11-05' },
  fechaPago: new Date('2026-11-01T12:00:00Z'),
  fechaPagoLocal: '2026-11-01',
  tarjeta: TARJETA,
  direccion: {
    nombreRecibe: 'Ana',
    telefonoRecibe: '55551234',
    departamento: 'Guatemala',
    municipio: 'Guatemala',
    direccionLinea: 'Zona 1',
    referencia: null,
  },
  lineas: [],
  historial: [],
};

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

  it('una falla de la base después del COMMIT de la cancelación responde el reembolso Pendiente', async () => {
    const { servicio, repositorio } = preparar(CANCELACION, { estado: 'NoExiste' });
    repositorio.tomarReembolso.mockRejectedValueOnce(new Error('base caída'));
    repositorio.obtener.mockResolvedValueOnce(PEDIDO_CANCELADO);

    const cancelacion = await servicio.cancelar(10, 'Ya no lo quiero');

    expect(cancelacion.reembolso).toEqual({ idReembolso: 3, estado: 'Pendiente' });
  });

  it('registra el fallo con el reclamo de la toma (un proceso desplazado no suma intentos)', async () => {
    const { servicio, repositorio, pasarela } = preparar(CANCELACION, {
      estado: 'Capturada',
      idTransaccion: 'txn-1',
      ...TARJETA,
    });
    pasarela.reembolsar.mockRejectedValueOnce(new Error('pasarela caída'));

    await servicio.procesar(3);

    expect(repositorio.actualizarReembolso.mock.calls[0]?.[0]).toMatchObject({
      idReembolso: 3,
      tokenReclamo: 'reclamo-1',
    });
  });

  it('el job devuelve null si la otra réplica tiene el bloqueo', async () => {
    const { servicio, repositorio } = preparar(null, { estado: 'NoExiste' });
    repositorio.obtenerReembolsosPendientes.mockResolvedValueOnce(null);

    expect(await servicio.reintentarPendientes()).toBeNull();
  });

  it('si la base falla tras devolver el dinero, el log conserva la transacción del reembolso', async () => {
    const registrado: string[] = [];
    const logger = pino({ level: 'error' }, { write: (linea: string) => registrado.push(linea) });
    const { servicio, repositorio } = preparar(CANCELACION, CAPTURADA, logger);
    repositorio.actualizarReembolso.mockRejectedValueOnce(new Error('base caída'));

    const cancelacion = servicio.cancelar(10, 'Ya no lo necesito');

    await expect(cancelacion).rejects.toThrow();
    expect(registrado.join('')).toContain('SIMR-1');
  });

  it('un fallo con el reclamo desplazado (Aplicado = 0) se registra como proceso desplazado', async () => {
    const registrado: string[] = [];
    const logger = pino({ level: 'warn' }, { write: (linea: string) => registrado.push(linea) });
    const { servicio, repositorio, pasarela } = preparar(CANCELACION, CAPTURADA, logger);
    pasarela.reembolsar.mockRejectedValueOnce(new Error('pasarela caída'));
    repositorio.actualizarReembolso.mockResolvedValueOnce({ estado: 'Pendiente', aplicado: false });

    const estado = await servicio.procesar(3);

    expect(estado).toBe('Pendiente');
    expect(registrado.join('')).toContain('Reclamo desplazado');
  });
});

describe('reembolsos: caché de reportes (E7-H04, A-11)', () => {
  it('cancelar y devolver invalidan los reportes después del commit, aunque el reembolso quede pendiente', async () => {
    const { servicio, repositorio, pasarela, invalidaciones } = preparar(CANCELACION, CAPTURADA);
    repositorio.obtener.mockResolvedValue(PEDIDO_CANCELADO);
    pasarela.reembolsar.mockRejectedValue(new Error('pasarela caída'));

    await servicio.cancelar(10, 'Ya no lo necesito');
    await servicio.registrarDevolucion(10, {
      motivo: 'Talla equivocada',
      lineas: [{ idDetallePedido: 1, cantidad: 1 }],
    });

    expect(invalidaciones).toHaveBeenCalledTimes(2);
  });

  it('una cancelación rechazada por el SP no invalida', async () => {
    const { servicio, repositorio, invalidaciones } = preparar(CANCELACION, CAPTURADA);
    repositorio.cancelar.mockRejectedValueOnce(new Error('NO_CANCELABLE'));

    await servicio.cancelar(10, 'Ya no lo necesito').catch(() => undefined);

    expect(invalidaciones).not.toHaveBeenCalled();
  });
});
