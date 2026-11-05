import { http, HttpResponse } from 'msw';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  carritoDePrueba,
  lineaDePrueba,
  simularCarrito,
  simularCarritoFallido,
  simularOperacion,
  simularOperacionFallida,
} from '../../../test/handlers/carrito';
import { renderizarRutas } from '../../../test/renderizar';
import { servidor } from '../../../test/servidor';

const abrirCarrito = () => renderizarRutas(crearRutas(), { ruta: '/carrito' });
const fila = (producto: string) =>
  screen.getByRole('heading', { name: producto }).closest('li') ?? document.body;

describe('CarritoPagina: líneas y resumen (M3-H02)', () => {
  it('muestra cada línea con los montos del backend, el conteo y el resumen', async () => {
    simularCarrito(
      carritoDePrueba(
        [
          lineaDePrueba(),
          lineaDePrueba({
            idLinea: 2,
            producto: 'Tenis urbanos',
            ilustracion: 'Tenis',
            color: 'Rojo',
            cantidad: 1,
            precioUnitario: '459.00',
            totalLinea: '459.00',
          }),
        ],
        { subtotal: '957.00', total: '957.00' },
      ),
    );
    abrirCarrito();

    const camisa = within(await screen.findByRole('list', { name: 'Productos del carrito' }));
    expect(camisa.getByText('Q498.00')).toBeInTheDocument();
    expect(camisa.getByRole('img', { name: 'Tenis color Rojo' })).toBeInTheDocument();
    expect(screen.getByText('2 productos, 3 unidades')).toBeInTheDocument();
    const resumen = within(screen.getByRole('region', { name: 'Resumen' }));
    expect(resumen.getByText('Se elige en el siguiente paso')).toBeInTheDocument();
    expect(resumen.getAllByText('Q957.00')).toHaveLength(2);
  });

  it('el encabezado muestra las unidades del carrito', async () => {
    simularCarrito(carritoDePrueba([lineaDePrueba({ cantidad: 4 })]));
    abrirCarrito();

    expect(
      await within(screen.getByRole('link', { name: /Carrito/ })).findByText('4'),
    ).toBeInTheDocument();
  });
});

describe('CarritoPagina: el mapa de avisos con MSW', () => {
  const lineas = [
    lineaDePrueba({ idLinea: 1, producto: 'No disponible', estado: 'NoDisponible' }),
    lineaDePrueba({ idLinea: 2, producto: 'Agotado', estado: 'Agotado' }),
    lineaDePrueba({
      idLinea: 3,
      producto: 'Excedido',
      estado: 'CantidadExcedida',
      cantidad: 5,
      ajustarA: 3,
    }),
    lineaDePrueba({
      idLinea: 4,
      producto: 'Subió',
      precioUnitario: '459.00',
      aviso: { tipo: 'CambioDePrecio', precioAnterior: '429.00' },
    }),
    lineaDePrueba({
      idLinea: 5,
      producto: 'Bajó',
      aviso: { tipo: 'BajoDePrecio', precioAnterior: '429.00' },
    }),
    lineaDePrueba({
      idLinea: 6,
      producto: 'Garantizado',
      aviso: { tipo: 'PrecioGarantizado', precioAnterior: null },
    }),
  ];

  it('cada estado y cada aviso muestran su texto; NoDisponible deshabilita la cantidad', async () => {
    simularCarrito(carritoDePrueba(lineas));
    abrirCarrito();
    await screen.findByRole('heading', { name: 'No disponible' });

    expect(within(fila('No disponible')).getByRole('alert')).toHaveTextContent(
      'Este producto ya no está disponible.',
    );
    expect(
      within(fila('No disponible')).getByRole('button', { name: 'Agregar uno' }),
    ).toBeDisabled();
    expect(
      within(fila('No disponible')).getByRole('button', { name: 'Eliminar No disponible' }),
    ).toBeEnabled();
    expect(within(fila('Agotado')).getByRole('alert')).toHaveTextContent(
      'Se agotó. Elimínalo para continuar.',
    );
    expect(
      within(fila('Excedido')).getByText(
        'Solo hay 3 disponibles. Ajusta la cantidad para continuar.',
      ),
    ).toBeInTheDocument();
    expect(
      within(fila('Subió')).getByText(
        'La garantía venció y el precio cambió de Q429.00 a Q459.00.',
      ),
    ).toBeInTheDocument();
    expect(
      within(fila('Bajó')).getByText('¡Bajó de precio! Antes costaba Q429.00.'),
    ).toBeInTheDocument();
    expect(
      within(fila('Garantizado')).getByText('Precio garantizado hasta el 8 de noviembre.'),
    ).toBeInTheDocument();
  });

  it('«Ajustar a 3» pide esa cantidad al backend', async () => {
    simularCarrito(carritoDePrueba(lineas));
    const recibidas = simularOperacion('patch', '/lineas/3', carritoDePrueba(lineas));
    const { usuario } = abrirCarrito();

    await usuario.click(await screen.findByRole('button', { name: 'Ajustar a 3' }));

    await waitFor(() => {
      expect(recibidas).toEqual([
        { cuerpo: { cantidad: 3 }, url: expect.stringContaining('/lineas/3') as unknown },
      ]);
    });
  });

  it('«Entendido» marca los avisos como vistos', async () => {
    simularCarrito(carritoDePrueba(lineas));
    const recibidas = simularOperacion('post', '/avisos/vistos', carritoDePrueba(lineas));
    const { usuario } = abrirCarrito();

    await usuario.click(await screen.findByRole('button', { name: 'Entendido' }));

    await waitFor(() => {
      expect(recibidas).toHaveLength(1);
    });
  });
});

describe('CarritoPagina: sin optimismo (A-02)', () => {
  it('cambiar la cantidad no mueve ningún monto hasta que responde el backend', async () => {
    simularCarrito(carritoDePrueba([lineaDePrueba()]));
    simularOperacion(
      'patch',
      '/lineas/1',
      carritoDePrueba([lineaDePrueba({ cantidad: 3, totalLinea: '747.00' })], {
        subtotal: '747.00',
        total: '747.00',
      }),
      { demora: 100 },
    );
    const { usuario } = abrirCarrito();
    const lista = await screen.findByRole('list', { name: 'Productos del carrito' });

    await usuario.click(within(lista).getByRole('button', { name: 'Agregar uno' }));

    expect(within(lista).getByText('Q498.00')).toBeInTheDocument();
    expect(within(lista).getByRole('status', { name: 'Cantidad' })).toHaveTextContent('2');
    expect(within(lista).getByRole('button', { name: 'Agregar uno' })).toBeDisabled();
    expect(within(lista).getByRole('button', { name: /Eliminar/ })).toBeDisabled();
    expect(await within(lista).findByText('Q747.00')).toBeInTheDocument();
    expect(within(lista).getByRole('status', { name: 'Cantidad' })).toHaveTextContent('3');
  });

  it('un 409 STOCK_INSUFICIENTE se avisa en la línea con el mensaje del backend', async () => {
    simularCarrito(carritoDePrueba([lineaDePrueba()]));
    simularOperacionFallida(
      'patch',
      '/lineas/1',
      409,
      'STOCK_INSUFICIENTE',
      'Solo quedan 2 unidades de esta talla.',
    );
    const { usuario } = abrirCarrito();

    await usuario.click(await screen.findByRole('button', { name: 'Agregar uno' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solo quedan 2 unidades de esta talla.',
    );
  });

  it('eliminar la última línea deja el carrito vacío con «Ver el catálogo»', async () => {
    simularCarrito(carritoDePrueba([lineaDePrueba()]));
    simularOperacion(
      'delete',
      '/lineas/1',
      carritoDePrueba([], { subtotal: '0.00', total: '0.00' }),
    );
    const { usuario } = abrirCarrito();

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Camisa Oxford' }));

    expect(await screen.findByText('Tu carrito está vacío')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el catálogo' })).toHaveAttribute('href', '/');
  });
});

describe('CarritoPagina: estados', () => {
  it('si el carrito no carga, muestra el error con Reintentar', async () => {
    simularCarritoFallido('req-carrito-1');
    abrirCarrito();

    expect(await screen.findByText('No pudimos cargar tu carrito.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Reintentar' }).length).toBeGreaterThan(0);
  });
});

describe('CarritoPagina: cupón y envío gratis (M3-H03)', () => {
  const conCupon = carritoDePrueba(
    [
      lineaDePrueba({ idLinea: 1, descuentoLinea: '10.00' }),
      lineaDePrueba({ idLinea: 2, producto: 'Tenis urbanos', descuentoLinea: '5.00' }),
    ],
    {
      // A propósito, distinto de la suma de las líneas: la pantalla muestra el del backend, no suma.
      descuento: '20.00',
      total: '976.00',
      cupon: { codigo: 'DEMO10', descripcion: '10 % de descuento (vigente)' },
    },
  );

  it('aplicar un cupón lo envía, muestra su aviso y los descuentos del backend', async () => {
    simularCarrito(carritoDePrueba());
    const recibidas = simularOperacion('put', '/cupon', conCupon);
    const { usuario } = abrirCarrito();

    await usuario.type(await screen.findByLabelText('¿Tienes un cupón?'), ' demo10 ');
    await usuario.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(
      await screen.findByText('Cupón DEMO10 aplicado: 10 % de descuento (vigente)'),
    ).toBeInTheDocument();
    expect(recibidas.map((r) => r.cuerpo)).toEqual([{ codigo: 'demo10' }]);
    const resumen = within(screen.getByRole('region', { name: 'Resumen' }));
    expect(resumen.getByText('Descuento (DEMO10)')).toBeInTheDocument();
    expect(resumen.getByText('Q20.00')).toBeInTheDocument();
    expect(within(fila('Camisa Oxford')).getByText('Q10.00')).toBeInTheDocument();
  });

  it('cada rechazo muestra el mensaje del backend', async () => {
    simularCarrito(carritoDePrueba());
    simularOperacionFallida(
      'put',
      '/cupon',
      422,
      'CUPON_MINIMO_NO_ALCANZADO',
      'Te faltan Q4,502.00 para usar este cupón.',
    );
    const { usuario } = abrirCarrito();

    await usuario.type(await screen.findByLabelText('¿Tienes un cupón?'), 'DEMOMINIMO');
    await usuario.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Te faltan Q4,502.00 para usar este cupón.',
    );
  });

  it('el rechazo por compra mínima muestra además cuánto falta, de los detalles del backend', async () => {
    simularCarrito(carritoDePrueba());
    servidor.use(
      http.put('/api/v1/carrito/cupon', () =>
        HttpResponse.json(
          {
            error: {
              codigo: 'CUPON_MINIMO_NO_ALCANZADO',
              mensaje: 'El carrito no alcanza la compra mínima del cupón.',
              detalles: { faltante: '4861.00' },
              requestId: 'req-cupon',
            },
          },
          { status: 422 },
        ),
      ),
    );
    const { usuario } = abrirCarrito();

    await usuario.type(await screen.findByLabelText('¿Tienes un cupón?'), 'DEMOMINIMO');
    await usuario.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El carrito no alcanza la compra mínima del cupón.',
    );
    expect(screen.getByText('Te faltan Q4,861.00.')).toBeInTheDocument();
  });

  it('«Quitar cupón» lo quita en el backend', async () => {
    simularCarrito(conCupon);
    const recibidas = simularOperacion('delete', '/cupon', carritoDePrueba());
    const { usuario } = abrirCarrito();

    await usuario.click(await screen.findByRole('button', { name: 'Quitar cupón' }));

    expect(await screen.findByLabelText('¿Tienes un cupón?')).toBeInTheDocument();
    expect(recibidas).toHaveLength(1);
  });

  it('un cupón retirado por el backend muestra su motivo', async () => {
    simularCarrito(
      carritoDePrueba([lineaDePrueba()], {
        cuponRetirado: {
          codigo: 'DEMO10',
          motivo: 'CUPON_VENCIDO',
          mensaje: 'Quitamos el cupón DEMO10: ya venció.',
        },
      }),
    );
    abrirCarrito();

    expect(await screen.findByText('Quitamos el cupón DEMO10: ya venció.')).toBeInTheDocument();
  });

  it('envío gratis: alcanzado, o cuánto falta con la barra de avance', async () => {
    simularCarrito(
      carritoDePrueba([lineaDePrueba()], {
        envioGratis: { montoMinimo: '1000.00', faltante: '292.00', alcanzado: false },
      }),
    );
    abrirCarrito();

    expect(await screen.findByText('Te faltan Q292.00 para el envío gratis.')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Avance hacia el envío gratis' }),
    ).toHaveAttribute('value', '70.8');
  });

  it('con el envío gratis alcanzado lo dice', async () => {
    simularCarrito(
      carritoDePrueba([lineaDePrueba()], {
        envioGratis: { montoMinimo: '400.00', faltante: '0.00', alcanzado: true },
      }),
    );
    abrirCarrito();

    expect(await screen.findByText('Tu pedido tiene envío gratis.')).toBeInTheDocument();
  });
});
