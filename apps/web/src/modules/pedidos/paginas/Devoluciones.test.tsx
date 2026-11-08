import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  pedidoDePrueba,
  pedidoGestionDePrueba,
  simularDevolucion,
  simularPedidoGestion,
  type PedidoGestionDePrueba,
} from '../../../test/handlers/pedidos';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = () =>
  renderizarRutas(crearRutas(), { ruta: '/backoffice/pedidos/41', rol: 'Operador' });

const lineaDePrueba = (
  cambios: Partial<PedidoGestionDePrueba['lineas'][number]>,
): PedidoGestionDePrueba['lineas'][number] => ({
  idDetallePedido: 1,
  idVariante: 10,
  sku: 'OXF-M-AZ',
  producto: 'Camisa Oxford',
  descripcionVariante: 'Azul / M',
  categoria: 'Camisas',
  cantidad: 2,
  cantidadDevuelta: 0,
  devolvible: 2,
  precioUnitario: '249.00',
  descuentoLinea: '0.00',
  totalLinea: '498.00',
  ...cambios,
});

const ENTREGADO = pedidoGestionDePrueba({
  estado: 'Entregado',
  transicionesPermitidas: [],
  puedeCancelar: false,
  puedeDevolver: true,
  lineas: [
    lineaDePrueba({}),
    lineaDePrueba({
      idDetallePedido: 2,
      sku: 'GOR-NEG',
      producto: 'Gorra',
      descripcionVariante: 'Negra',
      cantidad: 1,
      cantidadDevuelta: 1,
      devolvible: 0,
    }),
  ],
});

const abrirDialogo = async (usuario: ReturnType<typeof abrir>['usuario']) => {
  await usuario.click(await screen.findByRole('button', { name: 'Registrar devolución' }));
  return within(screen.getByRole('dialog', { name: 'Registrar devolución' }));
};

describe('devoluciones desde la gestión (M8-H04)', () => {
  it('sin puedeDevolver no se ofrece', async () => {
    simularPedidoGestion(pedidoGestionDePrueba({ puedeDevolver: false }));
    abrir();

    await screen.findByRole('heading', { name: 'Pedido SC-000041', level: 1 });
    expect(screen.queryByRole('button', { name: 'Registrar devolución' })).not.toBeInTheDocument();
  });

  it('cada línea devolvible ofrece de 0 a lo devolvible; la ya devuelta no aparece', async () => {
    simularPedidoGestion(ENTREGADO);
    const { usuario } = abrir();

    const dialogo = await abrirDialogo(usuario);
    const oxford = dialogo.getByRole('combobox', { name: 'Camisa Oxford, Azul / M' });
    expect(
      within(oxford)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['0', '1', '2']);
    expect(dialogo.queryByRole('combobox', { name: 'Gorra, Negra' })).not.toBeInTheDocument();
  });

  it('sin unidades elegidas no se envía (el mismo esquema que la API)', async () => {
    simularPedidoGestion(ENTREGADO);
    const recibidos = simularDevolucion({
      pedido: pedidoDePrueba(),
      montoReembolso: '0.00',
      estadoReembolso: 'Completado',
    });
    const { usuario } = abrir();

    const dialogo = await abrirDialogo(usuario);
    await usuario.type(dialogo.getByLabelText('Motivo'), 'Talla equivocada');
    await usuario.click(dialogo.getByRole('button', { name: 'Registrar devolución' }));

    expect(
      await dialogo.findByText('Elige al menos una unidad para devolver.'),
    ).toBeInTheDocument();
    expect(recibidos).toEqual([]);
  });

  it('envía solo las líneas con unidades y muestra el reembolso que calculó el backend', async () => {
    const lectura = simularPedidoGestion(ENTREGADO);
    const recibidos = simularDevolucion({
      pedido: pedidoDePrueba({ estado: 'DevueltoParcial' }),
      montoReembolso: '249.00',
      estadoReembolso: 'Completado',
    });
    const { usuario } = abrir();

    const dialogo = await abrirDialogo(usuario);
    lectura.reemplazar(
      pedidoGestionDePrueba({
        ...ENTREGADO,
        estado: 'DevueltoParcial',
        lineas: [lineaDePrueba({ cantidadDevuelta: 1, devolvible: 1 })],
      }),
    );
    await usuario.selectOptions(
      dialogo.getByRole('combobox', { name: 'Camisa Oxford, Azul / M' }),
      '1',
    );
    await usuario.type(dialogo.getByLabelText('Motivo'), 'Talla equivocada');
    await usuario.click(dialogo.getByRole('button', { name: 'Registrar devolución' }));

    expect(
      await screen.findByText('Registramos la devolución. El reembolso de Q249.00 se completó.'),
    ).toBeInTheDocument();
    expect(recibidos).toEqual([
      { motivo: 'Talla equivocada', lineas: [{ idDetallePedido: 1, cantidad: 1 }] },
    ]);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole('heading', { name: 'Pedido SC-000041', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Devuelto parcial')).toBeInTheDocument();
  });

  it('un 422 muestra el mensaje del backend y vuelve a consultar lo devolvible', async () => {
    const lectura = simularPedidoGestion(ENTREGADO);
    simularDevolucion({
      status: 422,
      codigo: 'DEVOLUCION_EXCEDE_VENDIDO',
      mensaje: 'La devolución excede lo vendido en algunas líneas.',
    });
    const { usuario } = abrir();

    const dialogo = await abrirDialogo(usuario);
    const lecturasAntes = lectura.lecturas.total;
    await usuario.selectOptions(
      dialogo.getByRole('combobox', { name: 'Camisa Oxford, Azul / M' }),
      '2',
    );
    await usuario.type(dialogo.getByLabelText('Motivo'), 'Talla equivocada');
    await usuario.click(dialogo.getByRole('button', { name: 'Registrar devolución' }));

    expect(await dialogo.findByRole('alert')).toHaveTextContent(
      'La devolución excede lo vendido en algunas líneas.',
    );
    await waitFor(() => {
      expect(lectura.lecturas.total).toBeGreaterThan(lecturasAntes);
    });
  });
});
