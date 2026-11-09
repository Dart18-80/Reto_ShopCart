import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  pagoEnRevisionDePrueba,
  reembolsoDePrueba,
  simularPagosEnRevision,
  simularReembolsos,
  simularReintento,
  simularResolverPago,
  simularResolverReembolso,
} from '../../../test/handlers/revision';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = (ruta: string, rol: 'Administrador' | 'Operador' = 'Administrador') =>
  renderizarRutas(crearRutas(), { ruta, rol });

const FALLIDO = reembolsoDePrueba();
const COMPLETADO = reembolsoDePrueba({
  idReembolso: 13,
  idPedido: null,
  numeroPedido: null,
  origen: 'SinPedido',
  estado: 'Completado',
  ultimoError: null,
  intentos: 1,
  puedeReintentar: false,
  puedeResolver: false,
});

const fila = async (texto: string) =>
  within((await screen.findByText(texto)).closest('tr') ?? document.body);

describe('ReembolsosPagina (M8-H05)', () => {
  it('lista los reembolsos con su estado y ofrece Reintentar y Resolver según lo que dice el backend', async () => {
    simularReembolsos([FALLIDO, COMPLETADO]);
    abrir('/backoffice/reembolsos');

    const fallido = await fila('#12');
    expect(fallido.getByRole('link', { name: 'SC-000041' })).toBeInTheDocument();
    expect(fallido.getByText('La pasarela no respondió. (3 intentos)')).toBeInTheDocument();
    expect(fallido.getByRole('button', { name: 'Reintentar el reembolso 12' })).toBeInTheDocument();
    expect(fallido.getByRole('button', { name: 'Resolver el reembolso 12' })).toBeInTheDocument();
    const completado = await fila('#13');
    expect(completado.getByText('Intento 900')).toBeInTheDocument();
    expect(completado.getByText('Cobro sin pedido')).toBeInTheDocument();
    expect(completado.queryByRole('button')).not.toBeInTheDocument();
  });

  it('uno que falló hace muy poco se puede reintentar pero todavía no resolver (puedeResolver del backend)', async () => {
    simularReembolsos([reembolsoDePrueba({ puedeResolver: false })]);
    abrir('/backoffice/reembolsos');

    const reciente = await fila('#12');
    expect(
      reciente.getByRole('button', { name: 'Reintentar el reembolso 12' }),
    ).toBeInTheDocument();
    expect(
      reciente.queryByRole('button', { name: 'Resolver el reembolso 12' }),
    ).not.toBeInTheDocument();
  });

  it('filtrar por estado va en la URL y al servidor', async () => {
    const { consultas } = simularReembolsos([FALLIDO]);
    const { usuario, router } = abrir('/backoffice/reembolsos');

    await usuario.selectOptions(await screen.findByLabelText('Estado'), 'Fallido');

    await waitFor(() => {
      expect(consultas.at(-1)?.get('estado')).toBe('Fallido');
    });
    expect(router.state.location.search).toBe('?estado=Fallido');
  });

  it('un reembolso Fallido se reintenta y su estado se actualiza sin recargar', async () => {
    const lista = simularReembolsos([FALLIDO]);
    const ids = simularReintento('Completado');
    const { usuario } = abrir('/backoffice/reembolsos');

    const fallido = await fila('#12');
    lista.reemplazar([
      reembolsoDePrueba({
        estado: 'Completado',
        ultimoError: null,
        puedeReintentar: false,
        puedeResolver: false,
      }),
    ]);
    await usuario.click(fallido.getByRole('button', { name: 'Reintentar el reembolso 12' }));

    expect(
      await screen.findByText('Reintentamos el reembolso #12: quedó completado.'),
    ).toBeInTheDocument();
    expect(ids).toEqual(['12']);
    const actualizado = await fila('#12');
    await waitFor(() => {
      expect(actualizado.getByText('Completado')).toBeInTheDocument();
    });
    expect(actualizado.queryByRole('button', { name: /Reintentar/ })).not.toBeInTheDocument();
  });

  it('resolver a mano envía el motivo y la referencia', async () => {
    simularReembolsos([FALLIDO]);
    const recibidos = simularResolverReembolso(
      reembolsoDePrueba({ estado: 'ResueltoManual', referenciaResolucion: 'TRF-77' }),
    );
    const { usuario } = abrir('/backoffice/reembolsos');

    await usuario.click(
      (await fila('#12')).getByRole('button', { name: 'Resolver el reembolso 12' }),
    );
    const dialogo = within(screen.getByRole('dialog', { name: 'Resolver el reembolso 12' }));
    await usuario.type(dialogo.getByLabelText('Motivo'), 'Transferencia manual');
    await usuario.type(dialogo.getByLabelText('Referencia'), 'TRF-77');
    await usuario.click(dialogo.getByRole('button', { name: 'Resolver' }));

    await waitFor(() => {
      expect(recibidos).toEqual([{ motivo: 'Transferencia manual', referencia: 'TRF-77' }]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('el plazo mínimo (409 REEMBOLSO_RECIENTE) muestra el mensaje del backend', async () => {
    simularReembolsos([FALLIDO]);
    simularResolverReembolso({
      status: 409,
      codigo: 'REEMBOLSO_RECIENTE',
      mensaje: 'Espera 30 minutos desde el último intento antes de resolverlo a mano.',
    });
    const { usuario } = abrir('/backoffice/reembolsos');

    await usuario.click(
      (await fila('#12')).getByRole('button', { name: 'Resolver el reembolso 12' }),
    );
    const dialogo = within(screen.getByRole('dialog'));
    await usuario.type(dialogo.getByLabelText('Motivo'), 'Transferencia manual');
    await usuario.type(dialogo.getByLabelText('Referencia'), 'TRF-77');
    await usuario.click(dialogo.getByRole('button', { name: 'Resolver' }));

    expect(await dialogo.findByRole('alert')).toHaveTextContent(
      'Espera 30 minutos desde el último intento antes de resolverlo a mano.',
    );
  });

  it('un Operador ve «Sin permiso»', async () => {
    abrir('/backoffice/reembolsos', 'Operador');

    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });
});

describe('PagosEnRevisionPagina (M8-H05)', () => {
  it('lista los pagos con su causa; un cobro sin pedido dice «Sin pedido»', async () => {
    simularPagosEnRevision([
      pagoEnRevisionDePrueba(),
      pagoEnRevisionDePrueba({
        idIntentoPago: 901,
        idPedido: null,
        numeroPedido: null,
        causa: 'CobroSinPedido',
      }),
    ]);
    abrir('/backoffice/pagos-en-revision');

    expect((await fila('#900')).getByText('La autorización ya no existía')).toBeInTheDocument();
    const sinPedido = await fila('#901');
    expect(sinPedido.getByText('Sin pedido')).toBeInTheDocument();
    expect(sinPedido.getByText('Cobro capturado sin pedido')).toBeInTheDocument();
  });

  it('sin resolución elegida no se envía; con ella, envía y resume lo que respondió el backend', async () => {
    simularPagosEnRevision([pagoEnRevisionDePrueba()]);
    const recibidos = simularResolverPago({ resolucion: 'SinCobro', reembolso: null });
    const { usuario } = abrir('/backoffice/pagos-en-revision');

    await usuario.click(
      (await fila('#900')).getByRole('button', { name: 'Resolver el intento 900' }),
    );
    const dialogo = within(screen.getByRole('dialog', { name: 'Resolver el intento 900' }));
    await usuario.type(dialogo.getByLabelText('Motivo'), 'La pasarela no tiene la captura');
    await usuario.click(dialogo.getByRole('button', { name: 'Resolver' }));
    expect(await dialogo.findByText('Elige cómo se resuelve.')).toBeInTheDocument();
    expect(recibidos).toEqual([]);

    await usuario.selectOptions(dialogo.getByLabelText('Resolución'), 'Sin cobro');
    expect(
      dialogo.getByText(
        'Para un intento con pedido sin captura: cancela el pedido, sin reembolso.',
      ),
    ).toBeInTheDocument();
    await usuario.click(dialogo.getByRole('button', { name: 'Resolver' }));

    expect(
      await screen.findByText('Resolvimos el intento #900 como «Sin cobro».'),
    ).toBeInTheDocument();
    expect(recibidos).toEqual([
      { resolucion: 'SinCobro', motivo: 'La pasarela no tiene la captura' },
    ]);
  });

  it('una resolución que no corresponde (422) muestra el mensaje del backend', async () => {
    simularPagosEnRevision([pagoEnRevisionDePrueba()]);
    simularResolverPago({
      status: 422,
      codigo: 'RESOLUCION_NO_APLICA',
      mensaje: 'Esa resolución no corresponde a este pago.',
    });
    const { usuario } = abrir('/backoffice/pagos-en-revision');

    await usuario.click(
      (await fila('#900')).getByRole('button', { name: 'Resolver el intento 900' }),
    );
    const dialogo = within(screen.getByRole('dialog'));
    await usuario.selectOptions(dialogo.getByLabelText('Resolución'), 'Reembolsar el cobro');
    await usuario.type(dialogo.getByLabelText('Motivo'), 'Revisado');
    await usuario.click(dialogo.getByRole('button', { name: 'Resolver' }));

    expect(await dialogo.findByRole('alert')).toHaveTextContent(
      'Esa resolución no corresponde a este pago.',
    );
  });
});
