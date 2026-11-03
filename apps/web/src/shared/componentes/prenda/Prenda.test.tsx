import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Prenda } from './Prenda';
import { TIPOS_DE_PRENDA } from './trazos';

describe('Prenda (FE-15)', () => {
  it('renderiza los seis tipos de Figma, cada uno con su nombre accesible', () => {
    expect(TIPOS_DE_PRENDA).toEqual([
      'Camisa',
      'Pantalón',
      'Vestido',
      'Chaqueta',
      'Tenis',
      'Gorra',
    ]);

    for (const tipo of TIPOS_DE_PRENDA) {
      const { unmount } = render(<Prenda tipo={tipo} color="Azul marino" />);
      expect(screen.getByRole('img', { name: `${tipo} color Azul marino` })).toBeInTheDocument();
      unmount();
    }
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
});
