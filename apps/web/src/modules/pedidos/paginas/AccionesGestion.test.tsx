import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  pedidoDePrueba,
  pedidoGestionDePrueba,
  simularCambioEstado,
  simularCancelacionGestion,
  simularPedidoGestion,
} from '../../../test/handlers/pedidos';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = () =>
  renderizarRutas(crearRutas(), { ruta: '/backoffice/pedidos/41', rol: 'Operador' });

const PAGADO = pedidoGestionDePrueba();
const EN_PREPARACION = pedidoGestionDePrueba({
  estado: 'EnPreparacion',
  transicionesPermitidas: ['Despachado'],
});

const accion = async (nombre: string) => screen.findByRole('button', { name: nombre });
const dialogo = (nombre?: string) => within(screen.getByRole('dialog', { name: nombre }));

describe('cambiar el estado desde la gestión (M8-H03)', () => {
  it('sin transiciones ni puedeCancelar, no hay acciones', async () => {
    simularPedidoGestion(
      pedidoGestionDePrueba({
        estado: 'Entregado',
        transicionesPermitidas: [],
        puedeCancelar: false,
      }),
    );
    abrir();

    await screen.findByRole('heading', { name: 'Pedido SC-000041', level: 1 });
    expect(screen.queryByRole('button', { name: /Pasar a|Marcar como/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
  });

  it('«Pasar a En preparación» envía el estado que se está viendo; sin motivo, no lo envía', async () => {
    const lectura = simularPedidoGestion(PAGADO);
    const recibidos = simularCambioEstado(pedidoDePrueba({ estado: 'EnPreparacion' }));
    const { usuario } = abrir();

    await usuario.click(await accion('Pasar a En preparación'));
    lectura.reemplazar(EN_PREPARACION);
    const paso = dialogo('Pasar a En preparación');
    expect(paso.getByText('El pedido SC-000041 pasa de Pagado a En preparación.')).toBeVisible();
    await usuario.click(paso.getByRole('button', { name: 'Pasar a En preparación' }));

    await waitFor(() => {
      expect(recibidos).toEqual([{ estadoEsperado: 'Pagado', estadoNuevo: 'EnPreparacion' }]);
    });
    expect(await accion('Marcar como despachado')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('el motivo opcional se envía cuando se escribe', async () => {
    simularPedidoGestion(PAGADO);
    const recibidos = simularCambioEstado(pedidoDePrueba({ estado: 'EnPreparacion' }));
    const { usuario } = abrir();

    await usuario.click(await accion('Pasar a En preparación'));
    await usuario.type(dialogo().getByLabelText('Motivo (opcional)'), 'Empacado en bodega 2');
    await usuario.click(dialogo().getByRole('button', { name: 'Pasar a En preparación' }));

    await waitFor(() => {
      expect(recibidos).toEqual([
        { estadoEsperado: 'Pagado', estadoNuevo: 'EnPreparacion', motivo: 'Empacado en bodega 2' },
      ]);
    });
  });

  it('un 409 de concurrencia avisa que el pedido cambió y lo vuelve a consultar', async () => {
    const lectura = simularPedidoGestion(PAGADO);
    simularCambioEstado({
      status: 409,
      codigo: 'CONFLICTO_CONCURRENCIA',
      mensaje: 'El pedido cambió de estado. Recarga para ver el estado actual.',
    });
    const { usuario } = abrir();

    await usuario.click(await accion('Pasar a En preparación'));
    const lecturasAntes = lectura.lecturas.total;
    lectura.reemplazar(EN_PREPARACION);
    await usuario.click(dialogo().getByRole('button', { name: 'Pasar a En preparación' }));

    expect(await screen.findByText(/El pedido cambió mientras lo veías/)).toBeInTheDocument();
    expect(lectura.lecturas.total).toBeGreaterThan(lecturasAntes);
    expect(await accion('Marcar como despachado')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByText(/El pedido cambió mientras lo veías/)).not.toBeInTheDocument();
  });

  it('otro 409 (cobro sin confirmar) muestra el mensaje del backend en el diálogo', async () => {
    simularPedidoGestion(PAGADO);
    simularCambioEstado({
      status: 409,
      codigo: 'PAGO_NO_CAPTURADO',
      mensaje: 'El cobro de este pedido aún no se confirma.',
    });
    const { usuario } = abrir();

    await usuario.click(await accion('Pasar a En preparación'));
    await usuario.click(dialogo().getByRole('button', { name: 'Pasar a En preparación' }));

    expect(await dialogo().findByRole('alert')).toHaveTextContent(
      'El cobro de este pedido aún no se confirma.',
    );
  });
});

describe('cancelar desde la gestión (M8-H03)', () => {
  it('el motivo es obligatorio con el mismo esquema que la API', async () => {
    simularPedidoGestion(PAGADO);
    const recibidos = simularCancelacionGestion({
      pedido: pedidoDePrueba({ estado: 'Cancelado' }),
      estadoReembolso: 'Completado',
    });
    const { usuario } = abrir();

    await usuario.click(await accion('Cancelar pedido'));
    await usuario.click(
      dialogo('Cancelar el pedido').getByRole('button', { name: 'Cancelar pedido' }),
    );

    expect(await dialogo().findByText('No puede estar vacío.')).toBeInTheDocument();
    expect(recibidos).toEqual([]);
  });

  it('con motivo, cancela y muestra el reembolso que devolvió el backend', async () => {
    const lectura = simularPedidoGestion(PAGADO);
    const recibidos = simularCancelacionGestion({
      pedido: pedidoDePrueba({ estado: 'Cancelado', montoReembolsado: '533.00' }),
      estadoReembolso: 'Completado',
    });
    const { usuario } = abrir();

    await usuario.click(await accion('Cancelar pedido'));
    lectura.reemplazar(
      pedidoGestionDePrueba({
        estado: 'Cancelado',
        transicionesPermitidas: [],
        puedeCancelar: false,
      }),
    );
    const cancelacion = dialogo('Cancelar el pedido');
    expect(
      cancelacion.getByText(
        'Los productos vuelven al inventario y el cobro se reembolsa a la tarjeta del cliente.',
      ),
    ).toBeVisible();
    await usuario.type(cancelacion.getByLabelText('Motivo'), 'Sin existencia en bodega');
    await usuario.click(cancelacion.getByRole('button', { name: 'Cancelar pedido' }));

    expect(
      await screen.findByText('Cancelamos el pedido. El reembolso de Q533.00 se completó.'),
    ).toBeInTheDocument();
    expect(recibidos).toEqual([{ motivo: 'Sin existencia en bodega' }]);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();
    });
  });

  it('un 409 NO_CANCELABLE muestra el mensaje y vuelve a consultar el pedido', async () => {
    const lectura = simularPedidoGestion(PAGADO);
    simularCancelacionGestion({
      status: 409,
      codigo: 'NO_CANCELABLE',
      mensaje: 'El pedido ya no se puede cancelar.',
    });
    const { usuario } = abrir();

    await usuario.click(await accion('Cancelar pedido'));
    lectura.reemplazar(
      pedidoGestionDePrueba({
        estado: 'Despachado',
        transicionesPermitidas: ['Entregado'],
        puedeCancelar: false,
      }),
    );
    await usuario.type(dialogo().getByLabelText('Motivo'), 'Lo pidió el cliente');
    await usuario.click(dialogo().getByRole('button', { name: 'Cancelar pedido' }));

    expect(await screen.findByText('El pedido ya no se puede cancelar.')).toBeInTheDocument();
    expect(await accion('Marcar como entregado')).toBeInTheDocument();
  });
});
