import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderizar, renderizarRutas } from '../test/renderizar';
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
