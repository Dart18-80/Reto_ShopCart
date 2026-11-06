import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import { simularCarrito } from '../../../test/handlers/carrito';
import { pedidoDePrueba, simularCancelacion, simularPedido } from '../../../test/handlers/pedidos';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = () => renderizarRutas(crearRutas(), { ruta: '/pedidos/41', rol: 'Cliente' });

const CANCELADO = pedidoDePrueba({
  estado: 'Cancelado',
  puedeCancelar: false,
  montoReembolsado: '533.00',
  historial: [
    ...pedidoDePrueba().historial,
    {
      estadoAnterior: 'Pagado',
      estadoNuevo: 'Cancelado',
      rol: 'Cliente',
      motivo: 'Me equivoqué de talla',
      fecha: '2026-11-05T19:00:00.000Z',
    },
  ],
});

async function abrirDialogo() {
  simularCarrito();
  simularPedido(pedidoDePrueba());
  const pantalla = abrir();
  await pantalla.usuario.click(await screen.findByRole('button', { name: 'Cancelar pedido' }));
  const dialogo = within(await screen.findByRole('dialog', { name: 'Cancelar el pedido' }));
  return { ...pantalla, dialogo };
}

describe('cancelar mi pedido (M5-H02)', () => {
  it('«Cancelar pedido» solo aparece si el backend dice puedeCancelar', async () => {
    simularCarrito();
    simularPedido(pedidoDePrueba({ estado: 'Despachado', puedeCancelar: false }));
    abrir();

    await screen.findByRole('heading', { name: /Pedido SC-000041/ });
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
  });

  it('un motivo vacío no se envía: el mismo esquema que la API marca el campo', async () => {
    const recibidos = simularCancelacion({ pedido: CANCELADO, estadoReembolso: 'Pendiente' });
    const { usuario, dialogo } = await abrirDialogo();

    await usuario.type(dialogo.getByLabelText('Motivo'), '   ');
    await usuario.click(dialogo.getByRole('button', { name: 'Cancelar pedido' }));

    expect(dialogo.getByLabelText('Motivo')).toHaveAccessibleDescription('No puede estar vacío.');
    expect(recibidos).toEqual([]);
  });

  it('cancela con el motivo: el pedido se actualiza con la respuesta y avisa del reembolso', async () => {
    const recibidos = simularCancelacion({ pedido: CANCELADO, estadoReembolso: 'Pendiente' });
    const { usuario, dialogo } = await abrirDialogo();

    await usuario.type(dialogo.getByLabelText('Motivo'), 'Me equivoqué de talla');
    await usuario.click(dialogo.getByRole('button', { name: 'Cancelar pedido' }));

    expect(
      await screen.findByText(
        'Cancelamos tu pedido. El reembolso de Q533.00 a tu tarjeta está en proceso.',
      ),
    ).toBeInTheDocument();
    expect(recibidos).toEqual([{ motivo: 'Me equivoqué de talla' }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
    const seguimiento = within(screen.getByRole('region', { name: 'Seguimiento' }));
    expect(seguimiento.getByText('Me equivoqué de talla')).toBeInTheDocument();
  });

  it('el aviso dice el estado del reembolso que llega: completado', async () => {
    simularCancelacion({ pedido: CANCELADO, estadoReembolso: 'Completado' });
    const { usuario, dialogo } = await abrirDialogo();

    await usuario.type(dialogo.getByLabelText('Motivo'), 'Ya no lo necesito');
    await usuario.click(dialogo.getByRole('button', { name: 'Cancelar pedido' }));

    expect(
      await screen.findByText(
        'Cancelamos tu pedido. El reembolso de Q533.00 ya está en tu tarjeta.',
      ),
    ).toBeInTheDocument();
  });

  it('409 NO_CANCELABLE: el mensaje del backend y el pedido se vuelve a consultar', async () => {
    simularCancelacion({
      status: 409,
      codigo: 'NO_CANCELABLE',
      mensaje: 'El pedido ya no se puede cancelar: solo se cancela antes de despacharlo.',
    });
    const { usuario, dialogo } = await abrirDialogo();
    simularPedido(pedidoDePrueba({ estado: 'Despachado', puedeCancelar: false }));

    await usuario.type(dialogo.getByLabelText('Motivo'), 'Ya no lo necesito');
    await usuario.click(dialogo.getByRole('button', { name: 'Cancelar pedido' }));

    expect(await dialogo.findByRole('alert')).toHaveTextContent(
      'El pedido ya no se puede cancelar: solo se cancela antes de despacharlo.',
    );
    await waitFor(() => {
      expect(screen.getAllByText('Despachado').length).toBeGreaterThan(0);
    });
  });

  it('«Volver» cierra el diálogo sin cancelar', async () => {
    const recibidos = simularCancelacion({ pedido: CANCELADO, estadoReembolso: 'Pendiente' });
    const { usuario, dialogo } = await abrirDialogo();

    await usuario.click(dialogo.getByRole('button', { name: 'Volver' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(recibidos).toEqual([]);
  });
});
