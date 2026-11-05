import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import { carritoDePrueba, lineaDePrueba, simularCarrito } from '../../../test/handlers/carrito';
import {
  METODO_ESTANDAR,
  metodosDePrueba,
  sesionDePrueba,
  simularInicioDePago,
  simularMetodosEnvio,
  simularSesionPago,
} from '../../../test/handlers/checkout';
import { direccionDePrueba, simularLibretaDeDirecciones } from '../../../test/handlers/direcciones';
import { renderizarRutas } from '../../../test/renderizar';
import { servidor } from '../../../test/servidor';

const CASA = direccionDePrueba({ idDireccion: 1, alias: 'Casa', esPredeterminada: false });
const OFICINA = direccionDePrueba({ idDireccion: 2, alias: 'Oficina', esPredeterminada: true });

const CARRITO_CON_CUPON = carritoDePrueba([lineaDePrueba()], {
  subtotal: '498.00',
  descuento: '49.80',
  total: '448.20',
  cupon: { codigo: 'BIENVENIDA10', descripcion: '10 % de bienvenida' },
});

function preparar({ direcciones = [CASA, OFICINA] } = {}) {
  simularSesionPago(null);
  simularCarrito(CARRITO_CON_CUPON);
  simularMetodosEnvio();
  return simularLibretaDeDirecciones(direcciones);
}

const abrir = () => renderizarRutas(crearRutas(), { ruta: '/checkout', rol: 'Cliente' });
const resumen = async () => within(await screen.findByRole('region', { name: 'Tu pedido' }));
const fila = async (etiqueta: string) => (await resumen()).getByText(etiqueta).parentElement;
const continuar = () => screen.getByRole('button', { name: 'Continuar al pago' });

describe('CheckoutPagina, dirección y envío (M4-H02)', () => {
  it('elige la dirección predeterminada y el primer método; el total es el del método, tal como llega', async () => {
    preparar();
    abrir();

    expect(await screen.findByRole('radio', { name: /Oficina/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Casa/ })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: /Estándar/ })).toBeChecked();
    const tuPedido = await resumen();
    expect(tuPedido.getByText('Camisa Oxford × 2')).toBeInTheDocument();
    expect(await fila('Descuento (BIENVENIDA10)')).toHaveTextContent('−Q49.80');
    expect(await fila('Envío')).toHaveTextContent('Q35.00');
    expect(await fila('Total')).toHaveTextContent('Q533.00');
    expect(
      tuPedido.getByText('Al continuar apartamos tus productos por 15 minutos mientras pagas.'),
    ).toBeInTheDocument();
  });

  it('cambiar el método cambia el envío y el total por los que manda el backend para ese método', async () => {
    preparar();
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('radio', { name: /Express/ }));

    expect(await fila('Envío')).toHaveTextContent('Q75.00');
    expect(await fila('Total')).toHaveTextContent('Q573.00');
  });

  it('un método con envío gratis dice «Gratis»', async () => {
    preparar();
    simularMetodosEnvio(
      metodosDePrueba({
        metodos: [
          {
            ...METODO_ESTANDAR,
            costo: '0.00',
            envioGratis: true,
            totalConEnvio: '448.20',
          },
        ],
      }),
    );
    abrir();

    expect(await screen.findByRole('radio', { name: /Estándar.*Gratis/ })).toBeChecked();
    expect(await fila('Envío')).toHaveTextContent('Gratis');
    expect(await fila('Total')).toHaveTextContent('Q448.20');
  });

  it('los minutos del aviso salen de minutosReserva', async () => {
    preparar();
    simularMetodosEnvio(metodosDePrueba({ minutosReserva: 20 }));
    abrir();

    expect(
      await screen.findByText(
        'Al continuar apartamos tus productos por 20 minutos mientras pagas.',
      ),
    ).toBeInTheDocument();
  });

  it('sin direcciones muestra el formulario para la primera y no deja continuar sin ella', async () => {
    preparar({ direcciones: [] });
    const { usuario } = abrir();

    const formulario = within(await screen.findByRole('region', { name: 'Tu primera dirección' }));
    expect(continuar()).toBeDisabled();

    await usuario.type(formulario.getByLabelText('Quién recibe'), 'Ana Pérez');
    await usuario.type(formulario.getByLabelText('Teléfono'), '55551234');
    await usuario.type(formulario.getByLabelText('Dirección'), '5a avenida 10-20, zona 1');
    await usuario.selectOptions(formulario.getByLabelText('Departamento'), 'Guatemala');
    await usuario.selectOptions(
      await formulario.findByRole('combobox', { name: 'Municipio' }),
      'Mixco',
    );
    await usuario.click(formulario.getByRole('button', { name: 'Guardar dirección' }));

    expect(await screen.findByRole('radio', { name: /Ana Pérez/ })).toBeChecked();
    expect(continuar()).toBeEnabled();
  });

  it('«Continuar al pago» inicia la sesión con lo elegido y va a /checkout/pago', async () => {
    preparar();
    const recibidos = simularInicioDePago();
    const { usuario, router } = abrir();

    await usuario.click(await screen.findByRole('radio', { name: /Casa/ }));
    await usuario.click(screen.getByRole('radio', { name: /Express/ }));
    await usuario.click(continuar());

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/checkout/pago');
    });
    expect(recibidos).toEqual([{ idDireccion: 1, idMetodoEnvio: 2 }]);
  });

  it('con una sesión activa, recargar /checkout lleva a /checkout/pago', async () => {
    preparar();
    simularSesionPago(sesionDePrueba());
    const { router } = abrir();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/checkout/pago');
    });
  });

  it('409 STOCK_INSUFICIENTE lista las líneas con su disponible y ofrece volver al carrito', async () => {
    preparar();
    simularInicioDePago({
      status: 409,
      codigo: 'STOCK_INSUFICIENTE',
      mensaje: 'No hay existencia suficiente para algunos productos.',
      detalles: [{ idVariante: 10, producto: 'Camisa Oxford', cantidad: 2, disponible: 0 }],
    });
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Continuar al pago' }));

    const aviso = within(await screen.findByRole('alert'));
    expect(
      aviso.getByText('No hay existencia suficiente para algunos productos.'),
    ).toBeInTheDocument();
    expect(aviso.getByText('Camisa Oxford: pediste 2, quedan 0.')).toBeInTheDocument();
    expect(aviso.getByRole('link', { name: 'Volver al carrito' })).toHaveAttribute(
      'href',
      '/carrito',
    );
  });

  it('422 CARRITO_VACIO lleva al carrito', async () => {
    preparar();
    simularInicioDePago({
      status: 422,
      codigo: 'CARRITO_VACIO',
      mensaje: 'El carrito está vacío.',
    });
    const { usuario, router } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Continuar al pago' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/carrito');
    });
  });

  it('otro rechazo muestra el mensaje del backend', async () => {
    preparar();
    simularInicioDePago({
      status: 409,
      codigo: 'LINEAS_NO_DISPONIBLES',
      mensaje: 'Algunos productos del carrito ya no están disponibles.',
    });
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Continuar al pago' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Algunos productos del carrito ya no están disponibles.',
    );
  });

  it('con el carrito vacío lo dice y ofrece el catálogo', async () => {
    preparar();
    simularCarrito(carritoDePrueba([], { subtotal: '0.00', total: '0.00' }));
    abrir();

    expect(await screen.findByText('Tu carrito está vacío')).toBeInTheDocument();
  });

  it('si los métodos de envío no cargan, muestra el error con Reintentar', async () => {
    preparar();
    servidor.use(
      http.get('/api/v1/envios/metodos', () =>
        HttpResponse.json(
          {
            error: {
              codigo: 'ERROR_INTERNO',
              mensaje: 'No pudimos cargar los métodos de envío.',
              requestId: 'req-env',
            },
          },
          { status: 500 },
        ),
      ),
    );
    abrir();

    expect(await screen.findByText('No pudimos cargar los métodos de envío.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
