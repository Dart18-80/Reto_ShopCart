import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Prenda } from './Prenda';
import { ILUSTRACIONES_PRENDA } from '@shopcart/shared';

describe('Prenda (FE-15)', () => {
  it('renderiza las seis ilustraciones de la base, cada una con su nombre legible', () => {
    const nombres = ILUSTRACIONES_PRENDA.map((tipo) => {
      const { unmount } = render(<Prenda tipo={tipo} color="Azul marino" />);
      const nombre = screen.getByRole('img').getAttribute('aria-label');
      unmount();
      return nombre;
    });

    expect(nombres).toEqual([
      'Camisa color Azul marino',
      'Pantalón color Azul marino',
      'Vestido color Azul marino',
      'Chaqueta color Azul marino',
      'Tenis color Azul marino',
      'Gorra color Azul marino',
    ]);
  });

  it('la tela se rellena con currentColor y el color sale de la variable --prenda-* de la semilla', () => {
    render(<Prenda tipo="Camisa" color="Café" />);

    const figura = screen.getByRole('img', { name: 'Camisa color Café' });
    expect(figura).toHaveClass('text-prenda-cafe');
    expect(figura.querySelector('[data-capa="tela"]')).toHaveAttribute('fill', 'currentColor');
  });

  it('un color sin mapa usa un neutro', () => {
    render(<Prenda tipo="Gorra" color="Fucsia" />);

    expect(screen.getByRole('img', { name: 'Gorra color Fucsia' })).toHaveClass(
      'text-muted-foreground',
    );
  });

  it('sin color (un producto sin atributo Color) se dibuja en el neutro y su nombre no menciona color', () => {
    render(<Prenda tipo="Pantalon" />);

    expect(screen.getByRole('img', { name: 'Pantalón' })).toHaveClass('text-muted-foreground');
  });
});
