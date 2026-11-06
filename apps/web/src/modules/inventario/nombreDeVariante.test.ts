import { describe, expect, it } from 'vitest';
import { existenciaDePrueba } from '../../test/handlers/inventario';
import { nombreDeVariante } from './nombreDeVariante';

describe('nombreDeVariante', () => {
  it('el producto y los valores de sus atributos', () => {
    expect(nombreDeVariante(existenciaDePrueba())).toBe('Camisa Oxford, Azul / M');
  });

  it('sin atributos, solo el producto', () => {
    expect(nombreDeVariante(existenciaDePrueba({ descripcionAtributos: '' }))).toBe(
      'Camisa Oxford',
    );
  });
});
