import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import { simularCarrito } from '../../../test/handlers/carrito';
import { resumenDePrueba, simularMisPedidos } from '../../../test/handlers/pedidos';
import { renderizarRutas } from '../../../test/renderizar';
import { servidor } from '../../../test/servidor';

const abrir = (ruta = '/pedidos') => renderizarRutas(crearRutas(), { ruta, rol: 'Cliente' });

describe('MisPedidosPagina (M5-H01)', () => {
  it('una tarjeta por pedido: número, estado, fecha de Guatemala, artículos, total y «Ver detalle»', async () => {
    simularCarrito();
    simularMisPedidos([resumenDePrueba({ idPedido: 41, articulos: 2, total: '861.30' })]);
    abrir();

    const tarjeta = within(
      (await screen.findByRole('heading', { name: 'Pedido SC-000041' })).closest('li') ??
        document.body,
    );
    expect(tarjeta.getByText('Pagado')).toBeInTheDocument();
    expect(tarjeta.getByText('5 nov 2026, 2 artículos')).toBeInTheDocument();
    expect(tarjeta.getByText('Q861.30')).toBeInTheDocument();
    expect(tarjeta.getByRole('link', { name: /Ver detalle/ })).toHaveAttribute(
      'href',
      '/pedidos/41',
    );
  });

  it('los estados se muestran con su nombre: «En preparación», «Devuelto parcial»', async () => {
    simularCarrito();
    simularMisPedidos([
      resumenDePrueba({ idPedido: 1, numeroPedido: 'SC-000001', estado: 'EnPreparacion' }),
      resumenDePrueba({
        idPedido: 2,
        numeroPedido: 'SC-000002',
        estado: 'DevueltoParcial',
        articulos: 1,
      }),
    ]);
    abrir();

    expect(await screen.findByText('En preparación')).toBeInTheDocument();
    expect(screen.getByText('Devuelto parcial')).toBeInTheDocument();
    expect(screen.getByText('5 nov 2026, 1 artículo')).toBeInTheDocument();
  });

  it('la página está en la URL y la paginación la resuelve el servidor', async () => {
    simularCarrito();
    const consultas = simularMisPedidos([resumenDePrueba()], {
      pagina: 2,
      total: 25,
      totalPaginas: 3,
    });
    const { usuario, router } = abrir('/pedidos?pagina=2');

    await screen.findByRole('heading', { name: 'Pedido SC-000041' });
    expect(consultas[0]).toContain('pagina=2');
    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => {
      expect(router.state.location.search).toBe('?pagina=3');
    });
  });

  it('sin pedidos lo dice y ofrece el catálogo', async () => {
    simularCarrito();
    simularMisPedidos([]);
    abrir();

    expect(await screen.findByText('Todavía no tienes pedidos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute('href', '/');
  });

  it('si la lista no carga, muestra el error con Reintentar', async () => {
    simularCarrito();
    servidor.use(
      http.get('/api/v1/pedidos', () =>
        HttpResponse.json(
          {
            error: {
              codigo: 'ERROR_INTERNO',
              mensaje: 'No pudimos cargar tus pedidos.',
              requestId: 'r',
            },
          },
          { status: 500 },
        ),
      ),
    );
    abrir();

    expect(await screen.findByText('No pudimos cargar tus pedidos.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
