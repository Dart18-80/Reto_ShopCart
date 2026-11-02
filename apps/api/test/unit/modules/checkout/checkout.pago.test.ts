import { Decimal } from 'decimal.js';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { crearPagoService } from '../../../../src/modules/checkout/checkout.pago.js';
import type {
  Arrendamiento,
  CambioIntento,
  RegistroIntento,
} from '../../../../src/modules/checkout/checkout.types.js';
import type { Pedido } from '../../../../src/modules/pedidos/index.js';
import { AppError } from '../../../../src/shared/errors/index.js';
import {
  PasarelaSinRespuesta,
  type EstadoEnPasarela,
  type ResultadoAutorizacion,
} from '../../../../src/shared/pasarela/index.js';

const ID_INTENTO = 7;
const TOKEN = 'token-1';
const ARRENDAMIENTO = { idIntento: ID_INTENTO, token: TOKEN };
const ID_TRANSACCION = 'txn-1';
const CERO = new Decimal(0);

const PEDIDO: Pedido = {
  idPedido: 99,
  numeroPedido: 'SC-000099',
  estado: 'Pagado',
  subtotal: CERO,
  descuento: CERO,
  costoEnvio: CERO,
  total: CERO,
  baseImponible: CERO,
  iva: CERO,
  codigoCupon: null,
  envio: { nombre: 'Estándar', fechaEstimadaEntrega: '2026-11-05' },
  fechaPago: new Date('2026-11-01T12:00:00Z'),
  fechaPagoLocal: '2026-11-01',
  tarjeta: { marca: 'Visa', ultimosDigitos: '4242' },
  direccion: {
    nombreRecibe: 'Ana',
    telefonoRecibe: '55551234',
    departamento: 'Guatemala',
    municipio: 'Guatemala',
    direccionLinea: 'Zona 1',
    referencia: null,
  },
  lineas: [],
};

const AUTORIZADA: ResultadoAutorizacion = {
  tipo: 'Autorizada',
  idTransaccion: ID_TRANSACCION,
  marca: 'Visa',
  ultimosDigitos: '4242',
};

const SOLICITUD = {
  llave: 'llave-1',
  tarjeta: { numero: '4242424242424242', mesVencimiento: 12, anioVencimiento: 2030, cvv: '123' },
};

function preparar(registro: RegistroIntento) {
  const repositorio = {
    registrarIntento: vi.fn(() => Promise.resolve(registro)),
    actualizarIntento: vi.fn((_arrendamiento: Arrendamiento, _cambio: CambioIntento) =>
      Promise.resolve({ intentosRestantes: 4, sesionCancelada: false }),
    ),
    liberarArrendamiento: vi.fn((_arrendamiento: Arrendamiento) => Promise.resolve()),
  };
  const pedidos = {
    crearDeIntento: vi.fn(() => Promise.resolve(PEDIDO)),
    obtener: vi.fn((): Promise<Pedido | null> => Promise.resolve(PEDIDO)),
    obtenerDeIntento: vi.fn((): Promise<Pedido | null> => Promise.resolve(null)),
  };
  const pasarela = {
    autorizar: vi.fn(() => Promise.resolve(AUTORIZADA)),
    capturar: vi.fn(() => Promise.resolve()),
    anular: vi.fn(() => Promise.resolve()),
    reembolsar: vi.fn(() => Promise.reject(new Error('no se usa'))),
    consultar: vi.fn((): Promise<EstadoEnPasarela> => Promise.resolve({ estado: 'NoExiste' })),
  };
  const servicio = crearPagoService({
    repositorio,
    pedidos,
    pasarela,
    logger: pino({ level: 'silent' }),
    esperar: () => Promise.resolve(),
  });
  return { servicio, repositorio, pedidos, pasarela };
}

const AUTORIZAR: RegistroIntento = {
  accion: 'Autorizar',
  idIntento: ID_INTENTO,
  token: TOKEN,
  monto: new Decimal('149.90'),
};

describe('checkout.pago (E5-H03)', () => {
  it('registra el intento solo con la marca y los últimos 4 dígitos, nunca el número ni el CVV', async () => {
    const { servicio, repositorio } = preparar(AUTORIZAR);

    await servicio.pagar(SOLICITUD);

    expect(repositorio.registrarIntento).toHaveBeenCalledWith({
      llave: 'llave-1',
      marca: 'Visa',
      ultimosDigitos: '4242',
      segundosArrendamiento: 15,
    });
  });

  it('autoriza, marca Autorizado, crea el pedido y captura, en ese orden', async () => {
    const { servicio, repositorio, pedidos, pasarela } = preparar(AUTORIZAR);

    const resultado = await servicio.pagar(SOLICITUD);

    expect(resultado).toEqual({ pedido: PEDIDO, creado: true });
    expect(repositorio.actualizarIntento.mock.calls).toEqual([
      [ARRENDAMIENTO, { estado: 'Autorizado', idTransaccion: ID_TRANSACCION }],
      [ARRENDAMIENTO, { estado: 'Capturado' }],
    ]);
    const orden = [
      pasarela.autorizar.mock.invocationCallOrder,
      pedidos.crearDeIntento.mock.invocationCallOrder,
      pasarela.capturar.mock.invocationCallOrder,
    ].flat();
    expect(orden).toHaveLength(3);
    expect(orden).toEqual([...orden].sort((a, b) => a - b));
  });

  it('si la pasarela no responde, libera el arrendamiento y responde PAGO_SIN_CONFIRMAR (504)', async () => {
    const { servicio, repositorio, pedidos, pasarela } = preparar(AUTORIZAR);
    pasarela.autorizar.mockRejectedValueOnce(new PasarelaSinRespuesta('autorizar'));

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'PAGO_SIN_CONFIRMAR', status: 504 });
    expect(repositorio.liberarArrendamiento).toHaveBeenCalledWith(ARRENDAMIENTO);
    expect(pedidos.crearDeIntento).not.toHaveBeenCalled();
  });

  it('un rechazo registra el intento Rechazado y responde 402 con los intentos restantes', async () => {
    const { servicio, repositorio, pedidos, pasarela } = preparar(AUTORIZAR);
    pasarela.autorizar.mockResolvedValueOnce({
      tipo: 'Rechazada',
      codigo: 'FONDOS_INSUFICIENTES',
      mensaje: 'Fondos insuficientes.',
      marca: 'Visa',
      ultimosDigitos: '0002',
    });

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toMatchObject({
      codigo: 'PAGO_RECHAZADO',
      status: 402,
      detalles: { intentosRestantes: 4, sesionCancelada: false },
    });
    expect(repositorio.actualizarIntento).toHaveBeenCalledWith(ARRENDAMIENTO, {
      estado: 'Rechazado',
      codigo: 'FONDOS_INSUFICIENTES',
      mensaje: 'Fondos insuficientes.',
    });
    expect(pedidos.crearDeIntento).not.toHaveBeenCalled();
  });

  it('si el pedido falla, anula la autorización con el código del error y lo relanza (RF-06)', async () => {
    const { servicio, repositorio, pedidos, pasarela } = preparar(AUTORIZAR);
    const falla = new AppError('STOCK_INSUFICIENTE', { mensaje: 'Sin existencia.' });
    pedidos.crearDeIntento.mockRejectedValueOnce(falla);

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toBe(falla);
    expect(pasarela.anular).toHaveBeenCalledWith(ID_TRANSACCION);
    expect(pasarela.capturar).not.toHaveBeenCalled();
    expect(repositorio.actualizarIntento).toHaveBeenLastCalledWith(ARRENDAMIENTO, {
      estado: 'Anulado',
      codigo: 'STOCK_INSUFICIENTE',
      mensaje: 'Sin existencia.',
    });
  });

  it('si la petición falla después del COMMIT del pedido, no anula: captura y responde el pedido (RF-06)', async () => {
    const { servicio, repositorio, pedidos, pasarela } = preparar(AUTORIZAR);
    pedidos.crearDeIntento.mockRejectedValueOnce(new Error('timeout al leer el detalle'));
    pedidos.obtenerDeIntento.mockResolvedValueOnce(PEDIDO);

    const resultado = await servicio.pagar(SOLICITUD);

    expect(resultado).toEqual({ pedido: PEDIDO, creado: true });
    expect(pedidos.obtenerDeIntento).toHaveBeenCalledWith(ID_INTENTO);
    expect(pasarela.anular).not.toHaveBeenCalled();
    expect(pasarela.capturar).toHaveBeenCalledWith(ID_TRANSACCION);
    expect(repositorio.actualizarIntento).toHaveBeenLastCalledWith(ARRENDAMIENTO, {
      estado: 'Capturado',
    });
  });

  it('si otro proceso retomó el arrendamiento (fencing), no anula ni consulta el pedido', async () => {
    const { servicio, pedidos, pasarela } = preparar(AUTORIZAR);
    const perdido = new AppError('PAGO_EN_CURSO', { mensaje: 'Otro proceso tomó este pago.' });
    pedidos.crearDeIntento.mockRejectedValueOnce(perdido);

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toBe(perdido);
    expect(pedidos.obtenerDeIntento).not.toHaveBeenCalled();
    expect(pasarela.anular).not.toHaveBeenCalled();
  });

  it('Cerrar (sesión vencida) con autorización: la anula, cierra sin cobro y responde SESION_VENCIDA', async () => {
    const { servicio, repositorio, pasarela } = preparar({ accion: 'Cerrar', ...ARRENDAMIENTO });
    pasarela.consultar.mockResolvedValueOnce({
      estado: 'Autorizada',
      idTransaccion: ID_TRANSACCION,
      marca: 'Visa',
      ultimosDigitos: '4242',
    });

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'SESION_VENCIDA', status: 409 });
    expect(pasarela.autorizar).not.toHaveBeenCalled();
    expect(pasarela.anular).toHaveBeenCalledWith(ID_TRANSACCION);
    expect(repositorio.actualizarIntento).toHaveBeenCalledWith(
      ARRENDAMIENTO,
      expect.objectContaining({ estado: 'Anulado', codigo: 'SESION_VENCIDA' }),
    );
  });

  it('Cerrar sin autorización en la pasarela: el intento queda Fallido, sin autorizar', async () => {
    const { servicio, repositorio, pasarela } = preparar({ accion: 'Cerrar', ...ARRENDAMIENTO });

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'SESION_VENCIDA' });
    expect(pasarela.autorizar).not.toHaveBeenCalled();
    expect(repositorio.actualizarIntento).toHaveBeenCalledWith(ARRENDAMIENTO, {
      estado: 'Fallido',
      codigo: 'SESION_VENCIDA',
    });
  });

  it('si ni siquiera se puede comprobar el pedido, no anula: el intento queda para la conciliación', async () => {
    const { servicio, pedidos, pasarela } = preparar(AUTORIZAR);
    const causa = new Error('conexión perdida');
    pedidos.crearDeIntento.mockRejectedValueOnce(causa);
    pedidos.obtenerDeIntento.mockRejectedValueOnce(new Error('conexión perdida'));

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toBe(causa);
    expect(pasarela.anular).not.toHaveBeenCalled();
    expect(pasarela.capturar).not.toHaveBeenCalled();
  });

  it('un error inesperado de la pasarela también libera el arrendamiento y responde 504', async () => {
    const { servicio, repositorio, pasarela } = preparar(AUTORIZAR);
    pasarela.autorizar.mockRejectedValueOnce(new TypeError('bug del adaptador'));

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'PAGO_SIN_CONFIRMAR', status: 504 });
    expect(repositorio.liberarArrendamiento).toHaveBeenCalledWith(ARRENDAMIENTO);
  });

  it('si liberar el arrendamiento falla, igual responde PAGO_SIN_CONFIRMAR con la causa original', async () => {
    const { servicio, repositorio, pasarela } = preparar(AUTORIZAR);
    const causa = new PasarelaSinRespuesta('autorizar');
    pasarela.autorizar.mockRejectedValueOnce(causa);
    repositorio.liberarArrendamiento.mockRejectedValueOnce(new Error('base caída'));

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'PAGO_SIN_CONFIRMAR', cause: causa });
  });

  it('reintenta la anulación y, si sigue fallando, deja el intento Autorizado para la conciliación', async () => {
    const { servicio, repositorio, pedidos, pasarela } = preparar(AUTORIZAR);
    pedidos.crearDeIntento.mockRejectedValueOnce(new Error('falla interna'));
    pasarela.anular.mockRejectedValue(new Error('pasarela caída'));

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect(pasarela.anular).toHaveBeenCalledTimes(3);
    expect(repositorio.actualizarIntento).not.toHaveBeenCalledWith(
      ARRENDAMIENTO,
      expect.objectContaining({ estado: 'Anulado' }),
    );
  });

  it('si la captura falla, el pago se responde igual y el intento queda Autorizado', async () => {
    const { servicio, repositorio, pasarela } = preparar(AUTORIZAR);
    pasarela.capturar.mockRejectedValueOnce(new Error('pasarela caída'));

    const resultado = await servicio.pagar(SOLICITUD);

    expect(resultado.creado).toBe(true);
    expect(repositorio.actualizarIntento).not.toHaveBeenCalledWith(ARRENDAMIENTO, {
      estado: 'Capturado',
    });
  });

  it('CrearPedido (autorizado al reanudar) crea el pedido sin volver a autorizar', async () => {
    const { servicio, pasarela, pedidos } = preparar({
      accion: 'CrearPedido',
      idIntento: ID_INTENTO,
      token: TOKEN,
      idTransaccion: ID_TRANSACCION,
    });

    const resultado = await servicio.pagar(SOLICITUD);

    expect(resultado.creado).toBe(true);
    expect(pasarela.autorizar).not.toHaveBeenCalled();
    expect(pedidos.crearDeIntento).toHaveBeenCalledWith(ID_INTENTO, TOKEN);
  });

  it('Capturar (pedido sin capturar) captura y devuelve el pedido existente (200)', async () => {
    const { servicio, pasarela, pedidos } = preparar({
      accion: 'Capturar',
      idIntento: ID_INTENTO,
      token: TOKEN,
      idTransaccion: ID_TRANSACCION,
      idPedido: PEDIDO.idPedido,
    });

    const resultado = await servicio.pagar(SOLICITUD);

    expect(resultado).toEqual({ pedido: PEDIDO, creado: false });
    expect(pasarela.capturar).toHaveBeenCalledWith(ID_TRANSACCION);
    expect(pedidos.crearDeIntento).not.toHaveBeenCalled();
  });

  it('Pedido (sesión ya pagada) devuelve el pedido sin tocar la pasarela (N-03)', async () => {
    const { servicio, pasarela } = preparar({ accion: 'Pedido', idPedido: PEDIDO.idPedido });

    const resultado = await servicio.pagar(SOLICITUD);

    expect(resultado).toEqual({ pedido: PEDIDO, creado: false });
    expect(pasarela.autorizar).not.toHaveBeenCalled();
    expect(pasarela.capturar).not.toHaveBeenCalled();
  });

  it('EnCurso responde PAGO_EN_CURSO con los segundos para reintentar', async () => {
    const { servicio } = preparar({ accion: 'EnCurso', segundosParaReintentar: 9 });

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'PAGO_EN_CURSO', status: 409 });
  });

  it('un Rechazado repetido con 0 intentos restantes informa que la sesión se canceló', async () => {
    const { servicio } = preparar({
      accion: 'Rechazado',
      mensaje: 'Fondos insuficientes.',
      intentosRestantes: 0,
    });

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toMatchObject({
      codigo: 'PAGO_RECHAZADO',
      detalles: { intentosRestantes: 0, sesionCancelada: true },
    });
  });

  it('un Error guardado con un código del catálogo se repite tal cual', async () => {
    const { servicio } = preparar({
      accion: 'Error',
      codigo: 'STOCK_INSUFICIENTE',
      mensaje: 'Sin existencia.',
    });

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'STOCK_INSUFICIENTE', message: 'Sin existencia.' });
  });

  it('un Error guardado con un código desconocido responde ERROR_INTERNO', async () => {
    const { servicio } = preparar({ accion: 'Error', codigo: 'OTRA_COSA', mensaje: null });

    const error = await servicio.pagar(SOLICITUD).catch((e: unknown) => e);

    expect(error).toMatchObject({ codigo: 'ERROR_INTERNO', status: 500 });
  });

  it('si el pedido de un pago ya hecho no aparece, es una falla interna', async () => {
    const { servicio, pedidos } = preparar({ accion: 'Pedido', idPedido: 5 });
    pedidos.obtener.mockResolvedValueOnce(null);

    await expect(servicio.pagar(SOLICITUD)).rejects.toThrow('El pedido 5 del pago no existe');
  });
});
