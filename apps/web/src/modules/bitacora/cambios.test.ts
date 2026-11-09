import { describe, expect, it } from 'vitest';
import { cambiosDe } from './cambios';

describe('cambiosDe (M10-H02)', () => {
  it('solo los campos que cambiaron, con su valor anterior y el nuevo', () => {
    expect(
      cambiosDe(
        { Precio: '100.00', Activo: true, Nombre: 'Gorra' },
        { Precio: '150.00', Activo: true, Nombre: 'Gorra' },
      ),
    ).toEqual([{ campo: 'Precio', antes: '100.00', despues: '150.00' }]);
  });

  it('una creación muestra todos los campos nuevos con «—» antes', () => {
    expect(cambiosDe(null, { Codigo: 'VERANO', Activo: false })).toEqual([
      { campo: 'Codigo', antes: '—', despues: 'VERANO' },
      { campo: 'Activo', antes: '—', despues: 'false' },
    ]);
  });

  it('null es un valor: se distingue de un campo ausente', () => {
    expect(cambiosDe({ Tope: null }, {})).toEqual([{ campo: 'Tope', antes: 'null', despues: '—' }]);
    expect(cambiosDe({ Tope: null }, { Tope: '5.00' })).toEqual([
      { campo: 'Tope', antes: 'null', despues: '5.00' },
    ]);
  });

  it('compara los valores crudos: 1 y "1" son distintos aunque se escriban igual', () => {
    expect(cambiosDe({ IDRol: 1 }, { IDRol: '1' })).toEqual([
      { campo: 'IDRol', antes: '1', despues: '1' },
    ]);
  });

  it('un valor que no es un objeto se muestra entero, no como «sin cambios»', () => {
    expect(cambiosDe('texto suelto', [1, 2])).toEqual([
      { campo: '(valor)', antes: 'texto suelto', despues: '[1,2]' },
    ]);
  });

  it('un objeto anidado se escribe como JSON', () => {
    expect(cambiosDe(null, { Detalle: { a: 1 } })).toEqual([
      { campo: 'Detalle', antes: '—', despues: '{"a":1}' },
    ]);
  });
});
