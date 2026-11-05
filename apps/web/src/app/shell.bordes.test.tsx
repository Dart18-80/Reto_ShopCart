import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sesion } from '../shared/api';
import { renderizar, renderizarRutas } from '../test/renderizar';
import { servidor } from '../test/servidor';
import { crearRutas } from './router';
import { SelectorTema } from './tema/SelectorTema';

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

describe('buscador del encabezado: casos borde', () => {
  it('solo espacios lleva al catálogo sin texto', async () => {
    const { usuario, router } = renderizarRutas(crearRutas(), { ruta: '/carrito' });
    await screen.findByRole('heading', { name: 'Carrito' });

    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar productos' }), '   {Enter}');

    expect(router.state.location.pathname).toBe('/');
    expect(router.state.location.search).toBe('');
  });

  it('tildes, ñ y caracteres reservados de la URL llegan íntegros', async () => {
    const { usuario, router } = renderizarRutas(crearRutas(), { ruta: '/' });
    await screen.findByRole('heading', { name: 'Catálogo' });

    await usuario.type(
      screen.getByRole('searchbox', { name: 'Buscar productos' }),
      'niño & cía #1{Enter}',
    );

    expect(new URLSearchParams(router.state.location.search).get('texto')).toBe('niño & cía #1');
  });
});

describe('tema: casos borde', () => {
  it('sin acceso al almacenamiento (modo privado) el selector funciona igual', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const { usuario } = renderizar(<SelectorTema />);

    await usuario.click(screen.getByRole('button', { name: 'Activar modo oscuro' }));

    expect(document.documentElement).toHaveClass('dark');
  });

  it('un valor guardado que no es un tema se ignora', () => {
    localStorage.setItem('shopcart-tema', 'morado');

    renderizar(<SelectorTema />);

    expect(document.documentElement).not.toHaveClass('dark');
    localStorage.clear();
  });
});

describe('cerrar sesión: casos borde', () => {
  it('si el logout falla por red, la sesión local se cierra igual y un aviso lo dice', async () => {
    servidor.use(http.post('/api/v1/auth/logout', () => HttpResponse.error()));
    const { usuario } = renderizarRutas(crearRutas(), { ruta: '/cuenta/perfil', rol: 'Cliente' });
    await screen.findByRole('heading', { name: 'Mi perfil' });

    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByText(/No pudimos conectar con la tienda/)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
    expect(sesion.estado()).toEqual({ tipo: 'invitado' });
  });
});

describe('rehidratación: casos borde', () => {
  it('un refresh que responde 200 sin cuerpo deja la sesión no verificada, no trabada', async () => {
    servidor.use(http.post('/api/v1/auth/refresh', () => new HttpResponse(null, { status: 200 })));

    await sesion.rehidratar();

    expect(sesion.estado()).toMatchObject({
      tipo: 'noVerificada',
      error: { codigo: 'RESPUESTA_INESPERADA' },
    });
  });
});
