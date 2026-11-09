import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

// D1: mientras carga, el botón muestra un spinner oculto para lectores de pantalla y conserva su texto.
describe('Button cargando (D1)', () => {
  it('conserva el nombre accesible y el texto', () => {
    render(
      <Button cargando disabled>
        Guardar
      </Button>,
    );

    const boton = screen.getByRole('button', { name: 'Guardar' });
    expect(boton).toHaveTextContent(/^Guardar$/);
  });

  it('el spinner lleva aria-hidden', () => {
    render(<Button cargando>Guardar</Button>);

    const spinner = screen.getByRole('button', { name: 'Guardar' }).querySelector('svg');
    expect(spinner).toHaveAttribute('aria-hidden', 'true');
  });

  it('sin cargar no hay spinner', () => {
    render(<Button>Guardar</Button>);

    expect(screen.getByRole('button', { name: 'Guardar' }).querySelector('svg')).toBeNull();
  });

  it('con asChild presta sus estilos al hijo (un enlace) sin agregar nada', () => {
    render(
      <Button asChild cargando>
        <a href="/carrito">Ir al carrito</a>
      </Button>,
    );

    expect(screen.getByRole('link', { name: 'Ir al carrito' }).querySelector('svg')).toBeNull();
  });

  it('no deshabilita por su cuenta: eso lo decide quien lo usa', () => {
    render(<Button cargando>Guardar</Button>);

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
  });
});
