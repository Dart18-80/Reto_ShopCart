import { describe, expect, it, vi } from 'vitest';
import { crearRevisionService } from '../../../../src/modules/pedidos/pedidos.revision.js';
import type {
  PagoParaResolver,
  PagoResuelto,
  ResolucionPago,
} from '../../../../src/modules/pedidos/pedidos.types.js';
import {
  PasarelaSinRespuesta,
  type EstadoEnPasarela,
} from '../../../../src/shared/pasarela/index.js';
import { invalidadorDePrueba } from '../../invalidador-de-prueba.js';

const LLAVE = '7f0a9f1e-5b1d-4c3f-9a4e-1b2c3d4e5f60';
const TARJETA = { marca: 'Visa', ultimosDigitos: '4242' };
const CAPTURADA: EstadoEnPasarela = { estado: 'Capturada', idTransaccion: 'SIM-1', ...TARJETA };
const ANULADA: EstadoEnPasarela = { estado: 'Anulada', idTransaccion: 'SIM-1', ...TARJETA };

function preparar({
  pago = { idIntentoPago: 7, llave: LLAVE, estado: 'EnRevision', idPedido: 3 },
  enPasarela = CAPTURADA,
  resuelto = {},
}: {
  pago?: PagoParaResolver | null;
  enPasarela?: EstadoEnPasarela | Error;
  resuelto?: Partial<PagoResuelto>;
} = {}) {
  const repositorio = {
    listarPagosEnRevision: vi.fn(),
    obtenerPagoEnRevision: vi.fn(() => Promise.resolve(pago)),
    resolverPago: vi.fn(
      (idIntentoPago: number, resolucion: ResolucionPago, motivo: string): Promise<PagoResuelto> =>
        Promise.resolve({
          idIntentoPago,
          estado: 'Capturado',
          resolucion,
          motivo,
          fechaResolucion: new Date(),
          idPedido: null,
          idReembolso: null,
          ...resuelto,
        }),
    ),
    resolverReembolso: vi.fn(),
    obtener: vi.fn(() => Promise.resolve(null)),
  };
  const pasarela = {
    consultar: vi.fn(() =>
      enPasarela instanceof Error ? Promise.reject(enPasarela) : Promise.resolve(enPasarela),
    ),
  };
  const reembolsos = { procesarTrasConfirmar: vi.fn(() => Promise.resolve('Completado' as const)) };
  const { reportes, invalidaciones } = invalidadorDePrueba();
  const servicio = crearRevisionService({ repositorio, pasarela, reembolsos, reportes });
  return { servicio, repositorio, pasarela, reembolsos, invalidaciones };
}

describe('revisión manual de pagos (E9-H04)', () => {
  it('un intento inexistente responde 404 sin consultar la pasarela', async () => {
    const { servicio, pasarela } = preparar({ pago: null });

    await expect(
      servicio.resolverPago(7, { resolucion: 'CobroVerificado', motivo: 'x' }),
    ).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' });
    expect(pasarela.consultar).not.toHaveBeenCalled();
  });

  it('un intento que ya no está en revisión responde 409 antes de consultar la pasarela', async () => {
    const { servicio, pasarela } = preparar({
      pago: { idIntentoPago: 7, llave: LLAVE, estado: 'Capturado', idPedido: 3 },
    });

    await expect(
      servicio.resolverPago(7, { resolucion: 'CobroVerificado', motivo: 'x' }),
    ).rejects.toMatchObject({ codigo: 'PAGO_NO_EN_REVISION' });
    expect(pasarela.consultar).not.toHaveBeenCalled();
  });

  it.each([
    ['CobroVerificado', ANULADA, 'COBRO_SIN_CAPTURA'],
    ['Reembolsar', ANULADA, 'COBRO_SIN_CAPTURA'],
    ['SinCobro', CAPTURADA, 'COBRO_CAPTURADO'],
  ] as const)(
    '%s sin la evidencia de la pasarela se rechaza y no escribe nada',
    async (resolucion, enPasarela, codigo) => {
      const { servicio, repositorio } = preparar({ enPasarela });

      await expect(servicio.resolverPago(7, { resolucion, motivo: 'x' })).rejects.toMatchObject({
        codigo,
      });
      expect(repositorio.resolverPago).not.toHaveBeenCalled();
    },
  );

  it('si la pasarela no responde, 504 y nada cambia', async () => {
    const { servicio, repositorio } = preparar({
      enPasarela: new PasarelaSinRespuesta('consultar'),
    });

    await expect(
      servicio.resolverPago(7, { resolucion: 'CobroVerificado', motivo: 'x' }),
    ).rejects.toMatchObject({ codigo: 'PASARELA_SIN_RESPUESTA', status: 504 });
    expect(repositorio.resolverPago).not.toHaveBeenCalled();
  });

  it('CobroVerificado guarda la transacción que confirmó la pasarela y no toca los reportes', async () => {
    const { servicio, repositorio, invalidaciones } = preparar();

    await servicio.resolverPago(7, {
      resolucion: 'CobroVerificado',
      motivo: 'Captura en el portal',
    });

    expect(repositorio.resolverPago).toHaveBeenCalledWith(
      7,
      'CobroVerificado',
      'Captura en el portal',
      'SIM-1',
    );
    expect(invalidaciones).not.toHaveBeenCalled();
  });

  it('SinCobro invalida las ventas de los reportes: cancela el pedido (A-11)', async () => {
    const { servicio, invalidaciones } = preparar({ enPasarela: ANULADA });

    await servicio.resolverPago(7, { resolucion: 'SinCobro', motivo: 'Sin cobro' });

    expect(invalidaciones).toHaveBeenCalledWith('reportes:ventas:version');
  });

  it('Reembolsar procesa en seguida el reembolso que dejó el SP', async () => {
    const { servicio, reembolsos } = preparar({ resuelto: { idReembolso: 41 } });

    const resolucion = await servicio.resolverPago(7, { resolucion: 'Reembolsar', motivo: 'x' });

    expect(reembolsos.procesarTrasConfirmar).toHaveBeenCalledWith(41, { idIntentoPago: 7 });
    expect(resolucion.reembolso).toEqual({ idReembolso: 41, estado: 'Completado' });
  });
});
