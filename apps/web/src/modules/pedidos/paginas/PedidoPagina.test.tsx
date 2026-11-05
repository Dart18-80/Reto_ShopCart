import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import { simularCarrito } from '../../../test/handlers/carrito';
import { pedidoDePrueba, simularPedido } from '../../../test/handlers/pedidos';
import { renderizarRutas } from '../../../test/renderizar';
import { servidor } from '../../../test/servidor';

const abrir = (ruta = '/pedidos/41') => renderizarRutas(crearRutas(), { ruta, rol: 'Cliente' });
const seccion = async (nombre: string) =>
  within(await screen.findByRole('region', { name: nombre }));

// Montos que no salen de sumar con `number`: si la web recalculara, se notaría (FE-10).
const PEDIDO_CON_CUPON = pedidoDePrueba({
  subtotal: '100.10',
  descuento: '33.37',
  codigoCupon: 'BIENVENIDA10',
  costoEnvio: '0.00',
  total: '66.74',
  baseImponible: '59.59',
  iva: '7.15',
  lineas: [
    {
      idDetallePedido: 1,
      idVariante: 10,
      sku: 'OXF-M-AZ',
      producto: 'Camisa Oxford',
      descripcionVariante: 'Azul / M',
      categoria: 'Camisas',
      cantidad: 2,
      cantidadDevuelta: 0,
      precioUnitario: '50.05',
      descuentoLinea: '33.37',
      totalLinea: '100.10',
    },
  ],
});

describe('PedidoPagina, el detalle de mi pedido (M5-H01)', () => {
  it('los artículos con SKU y variante, y los montos y el IVA tal como llegan del backend', async () => {
    simularCarrito();
    simularPedido(PEDIDO_CON_CUPON);
    abrir();

    expect(await screen.findByRole('heading', { name: /Pedido SC-000041/ })).toBeInTheDocument();
    const articulos = await seccion('Artículos');
    expect(articulos.getByText('Camisa Oxford × 2')).toBeInTheDocument();
    expect(articulos.getByText('Azul / M, SKU OXF-M-AZ')).toBeInTheDocument();
    expect(articulos.getByText('Subtotal').parentElement).toHaveTextContent('Q100.10');
    expect(articulos.getByText('Descuento (BIENVENIDA10)').parentElement).toHaveTextContent(
      '−Q33.37',
    );
    expect(articulos.getByText('Envío Estándar').parentElement).toHaveTextContent('Gratis');
    expect(articulos.getByText('Total').parentElement).toHaveTextContent('Q66.74');
    expect(
      articulos.getByText('Incluye IVA del 12 %: base imponible Q59.59 e IVA Q7.15.'),
    ).toBeInTheDocument();
  });

  it('la entrega con su fecha estimada y el pago con la tarjeta', async () => {
    simularCarrito();
    simularPedido(pedidoDePrueba());
    abrir();

    const entrega = await seccion('Entrega');
    expect(entrega.getByText('Ana Pérez, 55551234')).toBeInTheDocument();
    expect(entrega.getByText('Guatemala, Guatemala')).toBeInTheDocument();
    expect(entrega.getByText('Envío Estándar: fecha estimada 10 nov 2026.')).toBeInTheDocument();
    const pago = await seccion('Pago');
    expect(pago.getByText('Visa terminada en 4242')).toBeInTheDocument();
    expect(pago.getByText('5 nov 2026, 12:05')).toBeInTheDocument();
  });

  it('el seguimiento solo muestra los cambios del historial, con su motivo', async () => {
    simularCarrito();
    simularPedido(
      pedidoDePrueba({
        estado: 'Cancelado',
        puedeCancelar: false,
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
            estadoNuevo: 'Cancelado',
            rol: 'Cliente',
            motivo: 'Ya no lo necesito',
            fecha: '2026-11-05T19:10:00.000Z',
          },
        ],
      }),
    );
    abrir();

    const seguimiento = await seccion('Seguimiento');
    const pasos = seguimiento.getAllByRole('listitem');
    expect(pasos).toHaveLength(2);
    expect(pasos[1]).toHaveTextContent('Cancelado');
    expect(pasos[1]).toHaveTextContent('5 nov 2026, 13:10');
    expect(pasos[1]).toHaveTextContent('Ya no lo necesito');
    expect(seguimiento.queryByText('Entregado')).not.toBeInTheDocument();
  });

  it('con ?nuevo=1 agradece la compra', async () => {
    simularCarrito();
    simularPedido(pedidoDePrueba());
    abrir('/pedidos/41?nuevo=1');

    expect(await screen.findByText(/¡Gracias por tu compra!/)).toBeInTheDocument();
  });

  it('sin ?nuevo=1 no muestra el agradecimiento', async () => {
    simularCarrito();
    simularPedido(pedidoDePrueba());
    abrir();

    await screen.findByRole('heading', { name: /Pedido SC-000041/ });
    expect(screen.queryByText(/¡Gracias por tu compra!/)).not.toBeInTheDocument();
  });

  it('un pedido ajeno o inexistente (404) dice «No encontramos este pedido»', async () => {
    simularCarrito();
    simularPedido(null);
    abrir('/pedidos/999');

    expect(
      await screen.findByRole('heading', { name: 'No encontramos este pedido' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver mis pedidos' })).toHaveAttribute(
      'href',
      '/pedidos',
    );
  });

  it('un ID que no es un número es un pedido que no existe', async () => {
    simularCarrito();
    abrir('/pedidos/abc');

    expect(
      await screen.findByRole('heading', { name: 'No encontramos este pedido' }),
    ).toBeInTheDocument();
  });

  it('si el pedido no carga, muestra el error con Reintentar', async () => {
    simularCarrito();
    servidor.use(
      http.get('/api/v1/pedidos/:id', () =>
        HttpResponse.json(
          {
            error: {
              codigo: 'ERROR_INTERNO',
              mensaje: 'No pudimos cargar el pedido.',
              requestId: 'r',
            },
          },
          { status: 500 },
        ),
      ),
    );
    abrir();

    expect(await screen.findByText('No pudimos cargar el pedido.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
