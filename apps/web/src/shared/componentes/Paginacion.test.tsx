import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Paginacion } from './Paginacion';

describe('Paginacion', () => {
  it('resume la página con el formato de Figma: «Página 2 de 5, 93 resultados»', () => {
    render(
      <Paginacion
        paginacion={{ pagina: 2, tamano: 20, total: 93, totalPaginas: 5 }}
        onPagina={vi.fn()}
      />,
    );

    expect(screen.getByText('Página 2 de 5, 93 resultados')).toBeInTheDocument();
  });

  it('separa los miles como en Guatemala y usa el singular con un resultado', () => {
    const { rerender } = render(
      <Paginacion
        paginacion={{ pagina: 1, tamano: 20, total: 1532, totalPaginas: 77 }}
        onPagina={vi.fn()}
      />,
    );
    expect(screen.getByText('Página 1 de 77, 1,532 resultados')).toBeInTheDocument();

    rerender(
      <Paginacion
        paginacion={{ pagina: 1, tamano: 20, total: 1, totalPaginas: 1 }}
        onPagina={vi.fn()}
      />,
    );
    expect(screen.getByText('Página 1 de 1, 1 resultado')).toBeInTheDocument();
  });

  it('Anterior y Siguiente piden la página vecina y se deshabilitan en los extremos', async () => {
    const onPagina = vi.fn();
    render(
      <Paginacion
        paginacion={{ pagina: 1, tamano: 20, total: 45, totalPaginas: 3 }}
        onPagina={onPagina}
      />,
    );

    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(onPagina).toHaveBeenCalledWith(2);
  });
});
