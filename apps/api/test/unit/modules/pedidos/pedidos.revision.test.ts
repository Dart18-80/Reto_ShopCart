import { describe, expect, it, vi } from 'vitest';
import { SEGUNDOS_ANTES_DE_RESOLVER_A_MANO } from '../../../../src/modules/pedidos/pedidos.reembolsos.js';
import { crearRevisionService } from '../../../../src/modules/pedidos/pedidos.revision.js';
import type {
  PagoParaResolver,
  PagoResuelto,
  ReembolsoParaResolver,
  ResolucionPago,
} from '../../../../src/modules/pedidos/pedidos.types.js';
import {
  PasarelaSinRespuesta,
  type EstadoEnPasarela,
  type ReembolsoEnPasarela,
} from '../../../../src/shared/pasarela/index.js';
import { invalidadorDePrueba } from '../../invalidador-de-prueba.js';
import { pedidoDePrueba } from './pedido-de-prueba.js';

const LLAVE = '7f0a9f1e-5b1d-4c3f-9a4e-1b2c3d4e5f60';
const TARJETA = { marca: 'Visa', ultimosDigitos: '4242' };
const CAPTURADA: EstadoEnPasarela = { estado: 'Capturada', idTransaccion: 'SIM-1', ...TARJETA };
const ANULADA: EstadoEnPasarela = { estado: 'Anulada', idTransaccion: 'SIM-1', ...TARJETA };
const AUTORIZADA: EstadoEnPasarela = { estado: 'Autorizada', idTransaccion: 'SIM-1', ...TARJETA };
const CON_PEDIDO: PagoParaResolver = {
  idIntentoPago: 7,
  llave: LLAVE,
  estado: 'EnRevision',
  idPedido: 3,
};
const SIN_PEDIDO: PagoParaResolver = { ...CON_PEDIDO, idPedido: null };
const PEDIDO = pedidoDePrueba();
const LLAVE_INTENTO = '2b9c1d0e-7a6f-4e5d-8c3b-2a1f0e9d8c7b';
const LEIDO_EN = new Date('2026-11-02T18:00:00.000Z');
const REEMBOLSO_FALLIDO: ReembolsoParaResolver = {
  estado: 'Fallido',
  llave: LLAVE,
  llaveIntento: LLAVE_INTENTO,
  fechaActualizacion: LEIDO_EN,
  plazoCumplido: true,
};
const NO_EXISTE: EstadoEnPasarela = { estado: 'NoExiste' };
const RECHAZADA: EstadoEnPasarela = {
  estado: 'Rechazada',
  codigo: 'FONDOS_INSUFICIENTES',
  mensaje: 'Fondos insuficientes.',
  ...TARJETA,
};
const NO_PROCESADO: ReembolsoEnPasarela = { estado: 'NoExiste' };
const PROCESADO: ReembolsoEnPasarela = { estado: 'Procesado', idReembolso: 'SIMR-1' };
const RESOLUCION = { motivo: 'Devuelto por transferencia', referencia: 'TRF-1' };

function preparar({
  pago = CON_PEDIDO,
  enPasarela = CAPTURADA,
  resuelto = {},
  anulacion = Promise.resolve(),
  reembolso = REEMBOLSO_FALLIDO,
  reembolsoEnPasarela = NO_PROCESADO,
}: {
  pago?: PagoParaResolver | null;
  enPasarela?: EstadoEnPasarela | Error;
  resuelto?: Partial<PagoResuelto>;
  anulacion?: Promise<void>;
  reembolso?: ReembolsoParaResolver | null;
  reembolsoEnPasarela?: ReembolsoEnPasarela | Error;
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
          idPedido: pago?.idPedido ?? null,
          idReembolso: null,
          ...resuelto,
        }),
    ),
    obtenerReembolsoParaResolver: vi.fn(() => Promise.resolve(reembolso)),
    completarReembolsoProcesado: vi.fn(() => Promise.resolve()),
    marcarReembolsoNoAplica: vi.fn(() => Promise.resolve()),
    resolverReembolso: vi.fn(),
    obtener: vi.fn((idPedido: number) => Promise.resolve(idPedido === 3 ? PEDIDO : null)),
  };
  const pasarela = {
    consultar: vi.fn(() =>
      enPasarela instanceof Error ? Promise.reject(enPasarela) : Promise.resolve(enPasarela),
    ),
    anular: vi.fn(() => anulacion),
    consultarReembolso: vi.fn(() =>
      reembolsoEnPasarela instanceof Error
        ? Promise.reject(reembolsoEnPasarela)
        : Promise.resolve(reembolsoEnPasarela),
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
    ['Reembolsar', CON_PEDIDO],
    ['CobroVerificado', SIN_PEDIDO],
    ['SinCobro', SIN_PEDIDO],
  ] as const)(
    '%s que no corresponde al caso responde 422 RESOLUCION_NO_APLICA sin consultar la pasarela',
    async (resolucion, pago) => {
      const { servicio, pasarela, repositorio } = preparar({ pago });

      await expect(servicio.resolverPago(7, { resolucion, motivo: 'x' })).rejects.toMatchObject({
        codigo: 'RESOLUCION_NO_APLICA',
        status: 422,
      });
      expect(pasarela.consultar).not.toHaveBeenCalled();
      expect(repositorio.resolverPago).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['CobroVerificado', CON_PEDIDO, ANULADA, 'COBRO_SIN_CAPTURA'],
    ['Reembolsar', SIN_PEDIDO, ANULADA, 'COBRO_SIN_CAPTURA'],
    ['SinCobro', CON_PEDIDO, CAPTURADA, 'COBRO_CAPTURADO'],
  ] as const)(
    '%s sin la evidencia de la pasarela se rechaza y no escribe nada',
    async (resolucion, pago, enPasarela, codigo) => {
      const { servicio, repositorio } = preparar({ pago, enPasarela });

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

  it('SinCobro con una autorización vigente la anula en la pasarela antes de resolver', async () => {
    const { servicio, pasarela, repositorio } = preparar({ enPasarela: AUTORIZADA });

    await servicio.resolverPago(7, { resolucion: 'SinCobro', motivo: 'Sin cobro' });

    expect(pasarela.anular).toHaveBeenCalledWith('SIM-1');
    expect(pasarela.anular.mock.invocationCallOrder[0]).toBeLessThan(
      repositorio.resolverPago.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('SinCobro sin autorización vigente no llama a anular', async () => {
    const { servicio, pasarela } = preparar({ enPasarela: ANULADA });

    await servicio.resolverPago(7, { resolucion: 'SinCobro', motivo: 'Sin cobro' });

    expect(pasarela.anular).not.toHaveBeenCalled();
  });

  it('si anular la autorización no responde, 504 y nada cambia', async () => {
    const { servicio, repositorio } = preparar({
      enPasarela: AUTORIZADA,
      anulacion: Promise.reject(new PasarelaSinRespuesta('anular')),
    });

    await expect(
      servicio.resolverPago(7, { resolucion: 'SinCobro', motivo: 'x' }),
    ).rejects.toMatchObject({ codigo: 'PASARELA_SIN_RESPUESTA', status: 504 });
    expect(repositorio.resolverPago).not.toHaveBeenCalled();
  });

  it('SinCobro invalida las ventas de los reportes: cancela el pedido (A-11)', async () => {
    const { servicio, invalidaciones } = preparar({ enPasarela: ANULADA });

    await servicio.resolverPago(7, { resolucion: 'SinCobro', motivo: 'Sin cobro' });

    expect(invalidaciones).toHaveBeenCalledWith('reportes:ventas:version');
  });

  it('Reembolsar procesa en seguida el reembolso que dejó el SP', async () => {
    const { servicio, reembolsos } = preparar({ pago: SIN_PEDIDO, resuelto: { idReembolso: 41 } });

    const resolucion = await servicio.resolverPago(7, { resolucion: 'Reembolsar', motivo: 'x' });

    expect(reembolsos.procesarTrasConfirmar).toHaveBeenCalledWith(41, { idIntentoPago: 7 });
    expect(resolucion.reembolso).toEqual({ idReembolso: 41, estado: 'Completado' });
    expect(resolucion.pedido).toBeNull();
  });

  it('si el pedido resuelto no aparece, falla en lugar de responder sin él', async () => {
    const { servicio } = preparar({ resuelto: { idPedido: 99 } });

    await expect(
      servicio.resolverPago(7, { resolucion: 'CobroVerificado', motivo: 'x' }),
    ).rejects.toThrow(/pedido 99/);
  });
});

describe('resolución manual de un reembolso Fallido (E9-H04, decisión del PO)', () => {
  it('si la pasarela no lo procesó y el cobro está capturado, lo resuelve a mano con la versión leída y el plazo', async () => {
    const { servicio, repositorio, pasarela } = preparar();

    await servicio.resolverReembolso(5, RESOLUCION);

    expect(pasarela.consultarReembolso).toHaveBeenCalledWith(LLAVE);
    expect(pasarela.consultar).toHaveBeenCalledWith(LLAVE_INTENTO);
    expect(repositorio.resolverReembolso).toHaveBeenCalledWith(
      5,
      RESOLUCION,
      LEIDO_EN,
      SEGUNDOS_ANTES_DE_RESOLVER_A_MANO,
    );
    expect(repositorio.completarReembolsoProcesado).not.toHaveBeenCalled();
  });

  it('uno que falló hace menos del plazo responde 409 REEMBOLSO_RECIENTE sin consultar la pasarela', async () => {
    const { servicio, pasarela } = preparar({
      reembolso: { ...REEMBOLSO_FALLIDO, plazoCumplido: false },
    });

    await expect(servicio.resolverReembolso(5, RESOLUCION)).rejects.toMatchObject({
      codigo: 'REEMBOLSO_RECIENTE',
      status: 409,
    });
    expect(pasarela.consultarReembolso).not.toHaveBeenCalled();
  });

  it('si el cobro se anuló sin capturarse, lo marca NoAplica con el motivo y responde 409 REEMBOLSO_SIN_COBRO', async () => {
    const { servicio, repositorio, pasarela } = preparar({ enPasarela: ANULADA });

    await expect(servicio.resolverReembolso(5, RESOLUCION)).rejects.toMatchObject({
      codigo: 'REEMBOLSO_SIN_COBRO',
      status: 409,
    });
    expect(repositorio.marcarReembolsoNoAplica).toHaveBeenCalledWith(
      5,
      expect.stringContaining('anuló'),
      LEIDO_EN,
      SEGUNDOS_ANTES_DE_RESOLVER_A_MANO,
    );
    expect(pasarela.anular).not.toHaveBeenCalled();
    expect(repositorio.resolverReembolso).not.toHaveBeenCalled();
  });

  it.each([
    ['NoExiste', NO_EXISTE, 'no tiene el cobro'],
    ['Rechazada', RECHAZADA, 'rechazó el cobro'],
  ])(
    'con el cobro %s en la pasarela lo marca NoAplica con su motivo',
    async (_estado, enPasarela, motivo) => {
      const { servicio, repositorio } = preparar({ enPasarela });

      await expect(servicio.resolverReembolso(5, RESOLUCION)).rejects.toMatchObject({
        codigo: 'REEMBOLSO_SIN_COBRO',
      });
      expect(repositorio.marcarReembolsoNoAplica).toHaveBeenCalledWith(
        5,
        expect.stringContaining(motivo),
        LEIDO_EN,
        SEGUNDOS_ANTES_DE_RESOLVER_A_MANO,
      );
    },
  );

  it('si la consulta del cobro no responde, 504 y no escribe nada', async () => {
    const { servicio, repositorio } = preparar({
      enPasarela: new PasarelaSinRespuesta('consultar'),
    });

    await expect(servicio.resolverReembolso(5, RESOLUCION)).rejects.toMatchObject({
      codigo: 'PASARELA_SIN_RESPUESTA',
    });
    expect(repositorio.marcarReembolsoNoAplica).not.toHaveBeenCalled();
    expect(repositorio.resolverReembolso).not.toHaveBeenCalled();
  });

  it('con la autorización vigente (nunca capturada) la anula antes de marcarlo NoAplica', async () => {
    const { servicio, repositorio, pasarela } = preparar({ enPasarela: AUTORIZADA });

    await expect(servicio.resolverReembolso(5, RESOLUCION)).rejects.toMatchObject({
      codigo: 'REEMBOLSO_SIN_COBRO',
    });
    expect(pasarela.anular).toHaveBeenCalledWith('SIM-1');
    expect(pasarela.anular.mock.invocationCallOrder[0]).toBeLessThan(
      repositorio.marcarReembolsoNoAplica.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('al resolver un reembolso, si anular la autorización no responde, 504 y no lo marca NoAplica', async () => {
    const { servicio, repositorio } = preparar({
      enPasarela: AUTORIZADA,
      anulacion: Promise.reject(new PasarelaSinRespuesta('anular')),
    });

    await expect(servicio.resolverReembolso(5, RESOLUCION)).rejects.toMatchObject({
      codigo: 'PASARELA_SIN_RESPUESTA',
    });
    expect(repositorio.marcarReembolsoNoAplica).not.toHaveBeenCalled();
    expect(repositorio.resolverReembolso).not.toHaveBeenCalled();
  });

  it('si la pasarela ya lo procesó (la respuesta se perdió), queda Completado y la resolución se rechaza', async () => {
    const { servicio, repositorio } = preparar({ reembolsoEnPasarela: PROCESADO });

    await expect(servicio.resolverReembolso(5, RESOLUCION)).rejects.toMatchObject({
      codigo: 'REEMBOLSO_YA_PROCESADO',
      status: 409,
    });
    expect(repositorio.completarReembolsoProcesado).toHaveBeenCalledWith(5, 'SIMR-1');
    expect(repositorio.resolverReembolso).not.toHaveBeenCalled();
    expect(repositorio.marcarReembolsoNoAplica).not.toHaveBeenCalled();
  });

  it('un reembolso inexistente responde 404 sin consultar la pasarela', async () => {
    const { servicio, pasarela } = preparar({ reembolso: null });

    await expect(servicio.resolverReembolso(5, RESOLUCION)).rejects.toMatchObject({
      codigo: 'NO_ENCONTRADO',
      status: 404,
    });
    expect(pasarela.consultarReembolso).not.toHaveBeenCalled();
  });

  it('uno que ya no está Fallido responde 409 sin consultar la pasarela', async () => {
    const { servicio, pasarela } = preparar({
      reembolso: { ...REEMBOLSO_FALLIDO, estado: 'Completado' },
    });

    await expect(servicio.resolverReembolso(5, RESOLUCION)).rejects.toMatchObject({
      codigo: 'REEMBOLSO_NO_FALLIDO',
    });
    expect(pasarela.consultarReembolso).not.toHaveBeenCalled();
  });

  it('si la pasarela no responde, 504 y nada cambia', async () => {
    const { servicio, repositorio } = preparar({
      reembolsoEnPasarela: new PasarelaSinRespuesta('consultarReembolso'),
    });

    await expect(servicio.resolverReembolso(5, RESOLUCION)).rejects.toMatchObject({
      codigo: 'PASARELA_SIN_RESPUESTA',
      status: 504,
    });
    expect(repositorio.resolverReembolso).not.toHaveBeenCalled();
    expect(repositorio.completarReembolsoProcesado).not.toHaveBeenCalled();
  });
});
