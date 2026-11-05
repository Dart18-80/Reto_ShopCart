import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import { simularLogin, simularLoginFallido } from '../../../test/handlers/auth';
import { renderizarRutas } from '../../../test/renderizar';
import { estadoDeLaSesion } from '../../../test/sesion';

type Usuario = ReturnType<typeof renderizarRutas>['usuario'];

async function ingresar(usuario: Usuario, correo: string, contrasena: string) {
  await usuario.type(await screen.findByLabelText('Correo electrónico'), correo);
  await usuario.type(screen.getByLabelText('Contraseña'), contrasena);
  await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('IngresarPagina (M1-H01)', () => {
  it('muestra el formulario del frame con su título', async () => {
    renderizarRutas(crearRutas(), { ruta: '/ingresar' });

    expect(await screen.findByRole('heading', { name: 'Ingresa a tu cuenta' })).toBeInTheDocument();
    expect(screen.getByText('Para pagar y dar seguimiento a tus pedidos.')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
  });

  it('con credenciales incorrectas muestra el mensaje del backend en el aviso, nunca en un campo (N-15)', async () => {
    simularLoginFallido(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');
    const { usuario } = renderizarRutas(crearRutas(), { ruta: '/ingresar' });

    await ingresar(usuario, 'ana@prueba.gt', 'incorrecta1');

    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'false');
  });

  it('demasiados intentos (429) se avisan en el formulario', async () => {
    simularLoginFallido(
      429,
      'DEMASIADAS_PETICIONES',
      'Demasiados intentos. Espera un momento e intenta de nuevo.',
    );
    const { usuario } = renderizarRutas(crearRutas(), { ruta: '/ingresar' });

    await ingresar(usuario, 'ana@prueba.gt', 'incorrecta1');

    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos');
  });

  it('al ingresar abre la sesión y regresa a la ruta interna que se pedía', async () => {
    const cuerpos = simularLogin('Cliente');
    const { usuario, router } = renderizarRutas(crearRutas(), {
      ruta: '/ingresar?volver=%2Fcarrito',
    });

    await ingresar(usuario, '  ana@prueba.gt ', 'Secreta2026!');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/carrito');
    });
    expect(estadoDeLaSesion()).toMatchObject({ tipo: 'activa' });
    expect(cuerpos).toEqual([{ correo: 'ana@prueba.gt', contrasena: 'Secreta2026!' }]);
  });

  it('un volver externo se ignora: el personal va al backoffice', async () => {
    simularLogin('Operador');
    const { usuario, router } = renderizarRutas(crearRutas(), {
      ruta: '/ingresar?volver=https%3A%2F%2Fotro.sitio',
    });

    await ingresar(usuario, 'luis@prueba.gt', 'Secreta2026!');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/backoffice/pedidos');
    });
  });

  it('con sesión activa, abrir /ingresar lleva al destino', async () => {
    const { router } = renderizarRutas(crearRutas(), {
      ruta: '/ingresar?volver=%2Fpedidos',
      rol: 'Cliente',
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/pedidos');
    });
  });

  it('los avisos de la fusión del carrito (N-05) se muestran al entrar', async () => {
    simularLogin('Cliente', [
      {
        tipo: 'CantidadAjustada',
        idVariante: 5,
        producto: 'Camisa Oxford — M / Azul',
        cantidadSolicitada: 3,
        cantidadFinal: 1,
      },
      {
        tipo: 'FusionPendiente',
        mensaje: 'No pudimos pasar tu carrito; lo intentaremos de nuevo.',
      },
    ]);
    const { usuario } = renderizarRutas(crearRutas(), { ruta: '/ingresar' });

    await ingresar(usuario, 'ana@prueba.gt', 'Secreta2026!');

    expect(await screen.findByText(/Camisa Oxford — M \/ Azul.*1 de 3/)).toBeInTheDocument();
    expect(
      screen.getByText('No pudimos pasar tu carrito; lo intentaremos de nuevo.'),
    ).toBeInTheDocument();
  });

  it('«Crea una» lleva al registro conservando la ruta de regreso', async () => {
    const { usuario, router } = renderizarRutas(crearRutas(), {
      ruta: '/ingresar?volver=%2Fcarrito',
    });

    await usuario.click(await screen.findByRole('link', { name: 'Crea una' }));

    expect(router.state.location.pathname).toBe('/registro');
    expect(new URLSearchParams(router.state.location.search).get('volver')).toBe('/carrito');
  });
});
