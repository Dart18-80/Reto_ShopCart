import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FechaHora } from './FechaHora';
import { Monto } from './Monto';

describe('Monto y FechaHora', () => {
  it('Monto muestra el texto del backend formateado', () => {
    render(<Monto valor="578.00" />);

    expect(screen.getByText('Q578.00')).toBeInTheDocument();
  });

  it('FechaHora muestra la hora de Guatemala en un <time> con el instante original', () => {
    render(<FechaHora valor="2026-11-03T16:42:00.000Z" />);

    const hora = screen.getByText('3 nov 2026, 10:42');
    expect(hora.tagName).toBe('TIME');
    expect(hora).toHaveAttribute('datetime', '2026-11-03T16:42:00.000Z');
  });
});
