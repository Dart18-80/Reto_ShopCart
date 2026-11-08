import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  pedidoGestionDePrueba,
  resumenGestionDePrueba,
  simularPedidoGestion,
  simularPedidosGestion,
} from '../../../test/handlers/pedidos';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = (ruta = '/backoffice/pedidos', rol: 'Operador' | 'Cliente' = 'Operador') =>
  renderizarRutas(crearRutas(), { ruta, rol });

const PAGADO = resumenGestionDePrueba();
const ENTREGADO = resumenGestionDePrueba({
  idPedido: 42,
  numeroPedido: 'SC-000042',
  estado: 'DevueltoParcial',
  total: '1035.50',
  cliente: { idUsuario: 8, nombre: 'Carlos Pérez', correo: 'carlos@correo.gt' },
});

describe('GestionPedidosPagina (M8-H02)', () => {
  it('la tabla: número con enlace al detalle, fecha, cliente, estado y total', async () => {
    simularPedidosGestion([PAGADO, ENTREGADO]);
    abrir();

    const tabla = within(await screen.findByRole('table', { name: 'Pedidos' }));
    const fila = within(tabla.getByText('SC-000042').closest('tr') ?? document.body);
    expect(fila.getByRole('link', { name: 'SC-000042' })).toHaveAttribute(
      'href',
      '/backoffice/pedidos/42',
    );
    expect(fila.getByText('Carlos Pérez')).toBeInTheDocument();
    expect(fila.getByText('Devuelto parcial')).toBeInTheDocument();
    expect(fila.getByText('Q1,035.50')).toBeInTheDocument();
  });

  it('filtrar por estado y por cliente cambia la URL y lo resuelve el servidor (RF-08)', async () => {
    const consultas = simularPedidosGestion([PAGADO]);
    const { usuario, router } = abrir();

    await usuario.selectOptions(await screen.findByLabelText('Estado'), 'En preparación');
    await usuario.type(screen.getByLabelText('Cliente'), 'maria');

    await waitFor(() => {
      expect(Object.fromEntries(consultas.at(-1) ?? [])).toMatchObject({
        estado: 'EnPreparacion',
        cliente: 'maria',
      });
    });
    expect(Object.fromEntries(new URLSearchParams(router.state.location.search))).toEqual({
      estado: 'EnPreparacion',
      cliente: 'maria',
    });
  });

  it('el rango de días (AAAA-MM-DD, FE-10) va en la URL y al servidor', async () => {
    const consultas = simularPedidosGestion([PAGADO]);
    const { usuario, router } = abrir();

    await usuario.type(await screen.findByLabelText('Desde'), '2026-11-01');
    await usuario.type(screen.getByLabelText('Hasta'), '2026-11-05');

    await waitFor(() => {
      expect(Object.fromEntries(consultas.at(-1) ?? [])).toMatchObject({
        desde: '2026-11-01',
        hasta: '2026-11-05',
      });
    });
    expect(router.state.location.search).toBe('?desde=2026-11-01&hasta=2026-11-05');
  });

  it('un extremo del rango limita al otro', async () => {
    simularPedidosGestion([PAGADO]);
    abrir('/backoffice/pedidos?desde=2026-11-01&hasta=2026-11-05');

    expect(await screen.findByLabelText('Desde')).toHaveAttribute('max', '2026-11-05');
    expect(screen.getByLabelText('Hasta')).toHaveAttribute('min', '2026-11-01');
  });

  it('ordenar por total lo pide al servidor con la lista blanca (M6-H01)', async () => {
    const consultas = simularPedidosGestion([PAGADO, ENTREGADO]);
    const { usuario, router } = abrir();

    const tabla = within(await screen.findByRole('table', { name: 'Pedidos' }));
    await usuario.click(tabla.getByRole('button', { name: /Total/ }));

    await waitFor(() => {
      expect(router.state.location.search).toContain('orden=total');
    });
    await waitFor(() => {
      expect(consultas.at(-1)?.get('orden')).toBe('total');
    });
  });

  it('sin pedidos, un vacío que lo explica', async () => {
    simularPedidosGestion([]);
    abrir();

    expect(await screen.findByText('Todavía no hay pedidos')).toBeInTheDocument();
  });

  it('un Cliente que entra por URL ve «Sin permiso»', async () => {
    abrir('/backoffice/pedidos', 'Cliente');

    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });
});

describe('PedidoGestionPagina (M8-H02)', () => {
  it('los bloques del detalle más el cliente y el historial con su rol y su motivo', async () => {
    simularPedidoGestion(
      pedidoGestionDePrueba({
        estado: 'EnPreparacion',
        historial: [
          {
            estadoAnterior: null,
            estadoNuevo: 'Pagado',
            rol: 'Cliente',
            motivo: null,
            fecha: '2026-11-05T18:05:00.000Z',
          },
          {
            estadoAnterior: 'Pagado',
            estadoNuevo: 'EnPreparacion',
            rol: 'Operador',
            motivo: 'Empacado en bodega 2',
            fecha: '2026-11-05T19:00:00.000Z',
          },
        ],
      }),
    );
    abrir('/backoffice/pedidos/41');

    expect(
      await screen.findByRole('heading', { name: 'Pedido SC-000041', level: 1 }),
    ).toBeInTheDocument();
    const cliente = within(screen.getByRole('region', { name: 'Cliente' }));
    expect(cliente.getByText('María López')).toBeInTheDocument();
    expect(cliente.getByRole('link', { name: 'maria@correo.gt' })).toHaveAttribute(
      'href',
      'mailto:maria@correo.gt',
    );
    const historial = within(screen.getByRole('region', { name: 'Historial' }));
    expect(historial.getByText(/· Operador$/)).toBeInTheDocument();
    expect(historial.getByText('Motivo: Empacado en bodega 2')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Artículos' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Entrega' })).toBeInTheDocument();
  });

  it('un pedido que no existe dice «No encontramos este pedido»', async () => {
    simularPedidoGestion(null);
    abrir('/backoffice/pedidos/999');

    expect(
      await screen.findByRole('heading', { name: 'No encontramos este pedido' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver los pedidos' })).toHaveAttribute(
      'href',
      '/backoffice/pedidos',
    );
  });
});
