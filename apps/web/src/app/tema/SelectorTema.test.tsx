import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderizar } from '../../test/renderizar';
import { CLAVE_TEMA } from './ProveedorTema';
import { SelectorTema } from './SelectorTema';

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('SelectorTema', () => {
  it('cambia a modo oscuro y lo recuerda en este navegador', async () => {
    const { usuario } = renderizar(<SelectorTema />);

    await usuario.click(screen.getByRole('button', { name: 'Activar modo oscuro' }));

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem(CLAVE_TEMA)).toBe('oscuro');
    expect(screen.getByRole('button', { name: 'Activar modo claro' })).toBeInTheDocument();
  });

  it('al volver a cargar usa el tema guardado', () => {
    localStorage.setItem(CLAVE_TEMA, 'oscuro');

    renderizar(<SelectorTema />);

    expect(document.documentElement).toHaveClass('dark');
  });

  it('sin preferencia guardada sigue el tema del sistema', () => {
    renderizar(<SelectorTema />);

    expect(document.documentElement).not.toHaveClass('dark');
  });
});
