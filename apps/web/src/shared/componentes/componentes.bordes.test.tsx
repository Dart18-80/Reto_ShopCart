import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Paginacion } from './Paginacion';

describe('Paginacion: casos borde', () => {
  it('con total 0 dice «Página 1 de 1, 0 resultados» y no deja moverse', () => {
    render(
      <Paginacion
        paginacion={{ pagina: 1, tamano: 20, total: 0, totalPaginas: 0 }}
        onPagina={vi.fn()}
      />,
    );

    expect(screen.getByText('Página 1 de 1, 0 resultados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
  });

  it('en la última página no deja avanzar', () => {
    render(
      <Paginacion
        paginacion={{ pagina: 3, tamano: 20, total: 45, totalPaginas: 3 }}
        onPagina={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeEnabled();
  });

  it('Anterior pide la página previa', async () => {
    const onPagina = vi.fn();
    render(
      <Paginacion
        paginacion={{ pagina: 3, tamano: 20, total: 45, totalPaginas: 3 }}
        onPagina={onPagina}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));

    expect(onPagina).toHaveBeenCalledWith(2);
  });
});
