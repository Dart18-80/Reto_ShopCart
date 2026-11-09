import { describe, expect, it } from 'vitest';
import { cambiosDe } from './cambios';

describe('cambiosDe (M10-H02)', () => {
  it('solo los campos que cambiaron, con su valor anterior y el nuevo', () => {
    expect(
      cambiosDe(
        { Precio: 100, Activo: true, Nombre: 'Gorra' },
        { Precio: 150, Activo: true, Nombre: 'Gorra' },
      ),
    ).toEqual([{ campo: 'Precio', antes: '100', despues: '150' }]);
  });

  it('una creación muestra todos los campos nuevos con «—» antes', () => {
    expect(cambiosDe(null, { Codigo: 'VERANO', Activo: false })).toEqual([
      { campo: 'Codigo', antes: '—', despues: 'VERANO' },
      { campo: 'Activo', antes: '—', despues: 'false' },
    ]);
  });

  it('un campo que aparece o desaparece se muestra con «—» del otro lado', () => {
    expect(cambiosDe({ Tope: '5.00' }, { Descripcion: 'Nueva' })).toEqual([
      { campo: 'Tope', antes: '5.00', despues: '—' },
      { campo: 'Descripcion', antes: '—', despues: 'Nueva' },
    ]);
  });

  it('un valor que no es un objeto (o un objeto anidado) no rompe la vista', () => {
    expect(cambiosDe('texto suelto', { Detalle: { a: 1 } })).toEqual([
      { campo: 'Detalle', antes: '—', despues: '{"a":1}' },
    ]);
  });
});
