import { describe, expect, it } from 'vitest';
import { leerDependencias, ordenarProgramables } from '../src/orden.ts';

const programable = (nombre: string, ...dependencias: string[]) => ({ nombre, dependencias });
const nombres = (lista: { nombre: string }[]) => lista.map((elemento) => elemento.nombre);

describe('ordenarProgramables', () => {
  it('aplica los R__ por tipo: FU → VW → SP → TR', () => {
    const ordenados = ordenarProgramables([
      programable('R__TR_Pedidos_Bitacora.sql'),
      programable('R__SP_Pedidos_Crear.sql'),
      programable('R__VW_Dashboard_Ventas.sql'),
      programable('R__FU_Inventario_Disponible.sql'),
    ]);

    expect(nombres(ordenados)).toEqual([
      'R__FU_Inventario_Disponible.sql',
      'R__VW_Dashboard_Ventas.sql',
      'R__SP_Pedidos_Crear.sql',
      'R__TR_Pedidos_Bitacora.sql',
    ]);
  });

  it('dentro de un tipo usa el orden alfabético', () => {
    const ordenados = ordenarProgramables([programable('R__SP_B.sql'), programable('R__SP_A.sql')]);

    expect(nombres(ordenados)).toEqual(['R__SP_A.sql', 'R__SP_B.sql']);
  });

  it('una dependencia declarada se aplica antes, aunque el alfabético diga lo contrario', () => {
    const ordenados = ordenarProgramables([
      programable('R__FU_A.sql', 'R__FU_B.sql'),
      programable('R__FU_B.sql'),
    ]);

    expect(nombres(ordenados)).toEqual(['R__FU_B.sql', 'R__FU_A.sql']);
  });

  it('respeta una cadena de dependencias', () => {
    const ordenados = ordenarProgramables([
      programable('R__VW_A.sql', 'R__VW_B.sql'),
      programable('R__VW_B.sql', 'R__VW_C.sql'),
      programable('R__VW_C.sql'),
    ]);

    expect(nombres(ordenados)).toEqual(['R__VW_C.sql', 'R__VW_B.sql', 'R__VW_A.sql']);
  });

  it('falla con un mensaje claro ante una dependencia circular', () => {
    expect(() =>
      ordenarProgramables([
        programable('R__SP_A.sql', 'R__SP_B.sql'),
        programable('R__SP_B.sql', 'R__SP_A.sql'),
      ]),
    ).toThrow(/Dependencia circular entre: R__SP_A\.sql, R__SP_B\.sql/);
  });

  it('falla si la dependencia no existe', () => {
    expect(() => ordenarProgramables([programable('R__SP_A.sql', 'R__SP_NoExiste.sql')])).toThrow(
      /R__SP_A\.sql depende de R__SP_NoExiste\.sql, que no existe/,
    );
  });

  it('falla si la dependencia es de otro tipo', () => {
    expect(() =>
      ordenarProgramables([programable('R__VW_A.sql', 'R__FU_A.sql'), programable('R__FU_A.sql')]),
    ).toThrow(/que es de otro tipo/);
  });
});

describe('leerDependencias', () => {
  it('lee la lista de la primera línea "-- depende-de:"', () => {
    expect(leerDependencias('-- depende-de: R__FU_A.sql,  R__FU_B.sql \nCREATE ...')).toEqual([
      'R__FU_A.sql',
      'R__FU_B.sql',
    ]);
  });

  it('ignora el encabezado si no está en la primera línea', () => {
    expect(leerDependencias('-- comentario\n-- depende-de: R__FU_A.sql')).toEqual([]);
  });
});
