import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearRutas } from '../../../app/router';
import { carritoDePrueba, simularCarrito } from '../../../test/handlers/carrito';
import {
  sesionDePrueba,
  simularMetodosEnvio,
  simularSesionPago,
} from '../../../test/handlers/checkout';
import { simularLibretaDeDirecciones } from '../../../test/handlers/direcciones';
import {
  pedidoDePrueba,
  simularCancelacionDePago,
  simularPagos,
  type RespuestaDePago,
} from '../../../test/handlers/pago';
import { renderizarRutas } from '../../../test/renderizar';
import { servidor } from '../../../test/servidor';

type Usuario = ReturnType<typeof renderizarRutas>['usuario'];

const MINUTO_MS = 60_000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ANIO = new Date().getFullYear() + 2;
const TARJETA = {
  numeroTarjeta: '4242424242424242',
  mesVencimiento: 12,
  anioVencimiento: ANIO,
  cvv: '123',
};

const enQuinceMinutos = () => new Date(Date.now() + 15 * MINUTO_MS).toISOString();

function preparar(sesion = sesionDePrueba({ expiraEn: enQuinceMinutos() })) {
  simularSesionPago(sesion);
  simularCarrito();
  // Si la pantalla vuelve al checkout o al carrito, esas páginas encuentran sus datos.
  simularMetodosEnvio();
  simularLibretaDeDirecciones([]);
}

const abrir = () => renderizarRutas(crearRutas(), { ruta: '/checkout/pago', rol: 'Cliente' });
const formulario = async () =>
  within(await screen.findByRole('form', { name: 'Datos de la tarjeta' }));
const botonPagar = () => screen.getByRole('button', { name: /^Pagar Q/ });

async function llenarTarjeta(usuario: Usuario, numero = TARJETA.numeroTarjeta) {
  const datos = await formulario();
  await usuario.type(datos.getByLabelText('Número de tarjeta'), numero);
  await usuario.selectOptions(datos.getByLabelText('Mes'), '12');
  await usuario.selectOptions(datos.getByLabelText('Año'), String(ANIO));
  await usuario.type(datos.getByLabelText('CVV'), '123');
}

async function pagarCon(respuestas: RespuestaDePago[]) {
  preparar();
  const recibidos = simularPagos(respuestas);
  const pantalla = abrir();
  await llenarTarjeta(pantalla.usuario);
  await pantalla.usuario.click(botonPagar());
  return { ...pantalla, recibidos };
}

const error = (status: number, codigo: string, mensaje: string): RespuestaDePago => ({
  status,
  codigo,
  mensaje,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PagoPagina (M4-H03)', () => {
  it('sin una sesión activa vuelve a /checkout', async () => {
    preparar();
    simularSesionPago(null);
    const { router } = abrir();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/checkout');
    });
  });

  it('muestra la sesión congelada tal como llega: entrega, líneas, montos y el total en el botón', async () => {
    preparar();
    abrir();

    const resumen = within(await screen.findByRole('region', { name: 'Tu pedido' }));
    expect(resumen.getByText('Entrega a Ana Pérez')).toBeInTheDocument();
    expect(resumen.getByText('Camisa Oxford × 2')).toBeInTheDocument();
    expect(resumen.getByText('Envío').parentElement).toHaveTextContent('Q35.00');
    expect(resumen.getByText('Total').parentElement).toHaveTextContent('Q533.00');
    expect(botonPagar()).toHaveTextContent('Pagar Q533.00');
  });

  it('la cuenta regresiva llega a cero con el reloj simulado; «Volver a empezar» cancela y vuelve a /checkout', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date('2026-11-05T18:00:28.000Z'));
    preparar(sesionDePrueba({ expiraEn: '2026-11-05T18:15:00.000Z' }));
    const cancelaciones = simularCancelacionDePago();
    const { usuario, router } = abrir();

    expect(await screen.findByText('14:32')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(872_000);
    });

    expect(await screen.findByText(/Se acabó el tiempo de tu reserva/)).toBeInTheDocument();
    expect(botonPagar()).toBeDisabled();
    await usuario.click(screen.getByRole('button', { name: 'Volver a empezar' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/checkout');
    });
    expect(cancelaciones).toHaveLength(1);
  });

  it('201: paga con una llave UUID v4 y el cuerpo de la tarjeta, y va al pedido nuevo', async () => {
    const { recibidos, router } = await pagarCon([pedidoDePrueba({ idPedido: 41 })]);

    expect(await screen.findByRole('heading', { name: 'Pedido #41 creado' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?nuevo=1');
    expect(recibidos).toEqual([
      { llave: expect.stringMatching(UUID_V4) as unknown, cuerpo: TARJETA },
    ]);
  });

  it('al pagar, el carrito se vuelve a pedir: el encabezado ya no muestra sus unidades', async () => {
    let pagado = false;
    preparar();
    servidor.use(
      http.get('/api/v1/carrito', () =>
        HttpResponse.json({ datos: pagado ? carritoDePrueba([]) : carritoDePrueba() }),
      ),
      http.post('/api/v1/checkout/sesion/pagos', () => {
        pagado = true;
        return HttpResponse.json({ datos: pedidoDePrueba() }, { status: 201 });
      }),
    );
    const { usuario } = abrir();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Carrito/ })).toHaveTextContent('2');
    });

    await llenarTarjeta(usuario);
    await usuario.click(botonPagar());

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Carrito/ })).not.toHaveTextContent('2');
    });
  });

  it('mientras paga, el botón queda deshabilitado: un doble clic es una sola petición', async () => {
    preparar();
    const recibidos = simularPagos([pedidoDePrueba()], { demora: 300 });
    const { usuario } = abrir();
    await llenarTarjeta(usuario);

    await usuario.dblClick(botonPagar());

    expect(botonPagar()).toBeDisabled();
    expect(await screen.findByRole('heading', { name: /Pedido #41/ })).toBeInTheDocument();
    expect(recibidos).toHaveLength(1);
  });

  it('402 PAGO_RECHAZADO: el aviso del backend, el número y el CVV vacíos y el siguiente intento con otra llave', async () => {
    const { usuario, recibidos } = await pagarCon([
      error(402, 'PAGO_RECHAZADO', 'La tarjeta fue rechazada por fondos insuficientes.'),
      pedidoDePrueba(),
    ]);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La tarjeta fue rechazada por fondos insuficientes.',
    );
    const datos = await formulario();
    expect(datos.getByLabelText('Número de tarjeta')).toHaveValue('');
    expect(datos.getByLabelText('CVV')).toHaveValue('');

    await usuario.type(datos.getByLabelText('Número de tarjeta'), TARJETA.numeroTarjeta);
    await usuario.type(datos.getByLabelText('CVV'), '123');
    await usuario.click(botonPagar());

    await screen.findByRole('heading', { name: /Pedido #41/ });
    expect(recibidos[1]?.llave).toMatch(UUID_V4);
    expect(recibidos[1]?.llave).not.toBe(recibidos[0]?.llave);
  });

  it('409 PAGO_NO_COMPLETADO: el aviso del backend y el siguiente intento con otra llave', async () => {
    const mensaje = 'Tu pago no se completó y no se hizo ningún cobro. Vuelve a intentarlo.';
    const { usuario, recibidos } = await pagarCon([
      error(409, 'PAGO_NO_COMPLETADO', mensaje),
      pedidoDePrueba(),
    ]);

    expect(await screen.findByRole('alert')).toHaveTextContent(mensaje);
    const datos = await formulario();
    await usuario.type(datos.getByLabelText('Número de tarjeta'), TARJETA.numeroTarjeta);
    await usuario.type(datos.getByLabelText('CVV'), '123');
    await usuario.click(botonPagar());

    await screen.findByRole('heading', { name: /Pedido #41/ });
    expect(recibidos[1]?.llave).not.toBe(recibidos[0]?.llave);
  });

  it.each([
    [
      '504 PAGO_SIN_CONFIRMAR',
      error(
        504,
        'PAGO_SIN_CONFIRMAR',
        'No pudimos confirmar tu pago. Puedes reintentar: no se te cobrará dos veces.',
      ),
      'no se te cobrará dos veces',
    ],
    ['una falla de red', 'red' as const, 'No pudimos conectar con la tienda'],
    [
      '409 PAGO_EN_CURSO',
      error(409, 'PAGO_EN_CURSO', 'Tu pago se está procesando.'),
      'Estamos procesando tu pago',
    ],
  ])(
    '%s: aviso y «Reintentar» reenvía la misma solicitud con la misma llave',
    async (_fila, primera, texto) => {
      const { usuario, recibidos } = await pagarCon([primera, pedidoDePrueba()]);

      expect(await screen.findByText(new RegExp(texto))).toBeInTheDocument();
      const datos = await formulario();
      expect(datos.getByLabelText('Número de tarjeta')).toHaveValue('');
      expect(botonPagar()).toBeDisabled();

      // Con un cobro posiblemente hecho, la única salida es reintentar con la misma llave.
      expect(screen.getByRole('button', { name: 'Cambiar dirección o envío' })).toBeDisabled();
      await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

      await screen.findByRole('heading', { name: /Pedido #41/ });
      expect(recibidos).toHaveLength(2);
      expect(recibidos[1]).toEqual(recibidos[0]);
    },
  );

  it('409 SESION_VENCIDA: avisa, cancela la sesión y vuelve a /checkout', async () => {
    const cancelaciones = simularCancelacionDePago();
    const { router } = await pagarCon([error(409, 'SESION_VENCIDA', 'La sesión de pago venció.')]);

    expect(await screen.findByText('La sesión de pago venció.')).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/checkout');
    });
    expect(cancelaciones).toHaveLength(1);
  });

  it('409 MAX_INTENTOS: avisa y vuelve al carrito', async () => {
    const { router } = await pagarCon([
      error(409, 'MAX_INTENTOS', 'Se alcanzó el máximo de intentos de pago.'),
    ]);

    expect(
      await screen.findByText('Se alcanzó el máximo de intentos de pago.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/carrito');
    });
  });

  it('la tarjeta nunca queda en el estado de la mutación (solo en el intento)', async () => {
    const { queryClient } = await pagarCon([error(402, 'PAGO_RECHAZADO', 'Fondos insuficientes.')]);

    await screen.findByRole('alert');
    const variables = queryClient
      .getMutationCache()
      .getAll()
      .map((mutacion) => mutacion.state.variables);
    expect(variables.every((valor) => valor === undefined)).toBe(true);
  });

  it('422 LLAVE_REUTILIZADA no debe pasar: se muestra con su requestId', async () => {
    await pagarCon([
      error(422, 'LLAVE_REUTILIZADA', 'La llave de idempotencia ya se usó con otra solicitud.'),
    ]);

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('La llave de idempotencia ya se usó con otra solicitud.');
    expect(aviso).toHaveTextContent('req-pago');
  });

  it('400: la tarjeta vencida marca el año con el mensaje del backend', async () => {
    await pagarCon([
      {
        status: 400,
        codigo: 'VALIDACION_FALLIDA',
        mensaje: 'Los datos enviados no son válidos.',
        detalles: {
          errores: [{ campo: 'body.anioVencimiento', mensaje: 'La tarjeta está vencida.' }],
        },
      },
    ]);

    expect((await formulario()).getByLabelText('Año')).toHaveAccessibleDescription(
      'La tarjeta está vencida.',
    );
  });

  it('«Cambiar dirección o envío» cancela la sesión y vuelve a /checkout', async () => {
    preparar();
    const cancelaciones = simularCancelacionDePago();
    const { usuario, router } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Cambiar dirección o envío' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/checkout');
    });
    expect(cancelaciones).toHaveLength(1);
  });
});
