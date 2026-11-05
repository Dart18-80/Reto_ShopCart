import { describe, expect, it } from 'vitest';
import type { ProductoTienda } from './catalogo.api';
import {
  atributosDe,
  estadoDeOpcion,
  precioMenor,
  seleccionDe,
  seleccionInicial,
  varianteElegida,
} from './seleccionVariante';

type Variante = ProductoTienda['variantes'][number];
type Estado = Variante['estadoExistencia'];

const COLOR = 2;
const TALLA = 1;
const ID = { S: 10, M: 11, XL: 13, Azul: 20, Blanco: 21, Rojo: 22 } as const;
// ValorAtributo.Orden de cada valor: las tallas S, M, XL y los colores Azul, Blanco, Rojo.
const ORDEN = { S: 1, M: 2, XL: 4, Azul: 1, Blanco: 2, Rojo: 3 } as const;

const variante = (
  idVariante: number,
  talla: 'S' | 'M' | 'XL',
  color: 'Azul' | 'Blanco' | 'Rojo',
  estadoExistencia: Estado = 'Disponible',
): Variante => ({
  idVariante,
  sku: `SKU-${String(idVariante)}`,
  descripcionAtributos: `${talla} / ${color}`,
  precio: '249.00',
  estadoExistencia,
  valores: [
    {
      idAtributo: TALLA,
      atributo: 'Talla',
      idValorAtributo: ID[talla],
      valor: talla,
      orden: ORDEN[talla],
    },
    {
      idAtributo: COLOR,
      atributo: 'Color',
      idValorAtributo: ID[color],
      valor: color,
      orden: ORDEN[color],
    },
  ],
});

// La matriz del frame 24:314: XL existe en Azul pero está agotada; Rojo solo existe en S.
const MATRIZ: Variante[] = [
  variante(1, 'S', 'Azul'),
  variante(2, 'M', 'Azul'),
  variante(3, 'XL', 'Azul', 'Agotado'),
  variante(4, 'S', 'Blanco'),
  variante(5, 'M', 'Blanco', 'UltimasUnidades'),
  variante(6, 'XL', 'Blanco'),
  variante(7, 'S', 'Rojo'),
];

describe('selección de variante: solo con los datos que llegan (M2-H03)', () => {
  it('los atributos y sus valores salen de variantes[].valores, sin repetir', () => {
    expect(atributosDe(MATRIZ)).toEqual([
      {
        idAtributo: TALLA,
        nombre: 'Talla',
        valores: [
          { idValorAtributo: ID.S, valor: 'S' },
          { idValorAtributo: ID.M, valor: 'M' },
          { idValorAtributo: ID.XL, valor: 'XL' },
        ],
      },
      {
        idAtributo: COLOR,
        nombre: 'Color',
        valores: [
          { idValorAtributo: ID.Azul, valor: 'Azul' },
          { idValorAtributo: ID.Blanco, valor: 'Blanco' },
          { idValorAtributo: ID.Rojo, valor: 'Rojo' },
        ],
      },
    ]);
  });

  it('los valores de cada atributo se ordenan por ValorAtributo.Orden, no por el orden de las variantes', () => {
    const alReves = [
      variante(1, 'XL', 'Rojo'),
      variante(2, 'M', 'Blanco'),
      variante(3, 'S', 'Azul'),
    ];

    expect(atributosDe(alReves).map((a) => a.valores.map((v) => v.valor))).toEqual([
      ['S', 'M', 'XL'],
      ['Azul', 'Blanco', 'Rojo'],
    ]);
  });

  it('elegir un valor de cada atributo resuelve la variante; con uno solo, no', () => {
    expect(varianteElegida(MATRIZ, { [TALLA]: ID.M, [COLOR]: ID.Blanco })?.idVariante).toBe(5);
    expect(varianteElegida(MATRIZ, { [COLOR]: ID.Blanco })).toBeUndefined();
  });

  it('con Azul elegido, XL está agotada y S y M disponibles', () => {
    const seleccion = { [COLOR]: ID.Azul };

    expect(estadoDeOpcion(MATRIZ, seleccion, TALLA, ID.XL)).toBe('agotada');
    expect(estadoDeOpcion(MATRIZ, seleccion, TALLA, ID.S)).toBe('disponible');
    expect(estadoDeOpcion(MATRIZ, seleccion, TALLA, ID.M)).toBe('disponible');
  });

  it('y viceversa: con XL elegida, Azul está agotado y Rojo no existe', () => {
    const seleccion = { [TALLA]: ID.XL };

    expect(estadoDeOpcion(MATRIZ, seleccion, COLOR, ID.Azul)).toBe('agotada');
    expect(estadoDeOpcion(MATRIZ, seleccion, COLOR, ID.Rojo)).toBe('inexistente');
    expect(estadoDeOpcion(MATRIZ, seleccion, COLOR, ID.Blanco)).toBe('disponible');
  });

  it('el valor ya elegido de un atributo no restringe a los demás valores de ese mismo atributo', () => {
    const seleccion = { [TALLA]: ID.S, [COLOR]: ID.Rojo };

    expect(estadoDeOpcion(MATRIZ, seleccion, COLOR, ID.Azul)).toBe('disponible');
    expect(estadoDeOpcion(MATRIZ, seleccion, TALLA, ID.M)).toBe('inexistente');
  });

  it('UltimasUnidades cuenta como disponible', () => {
    expect(estadoDeOpcion(MATRIZ, { [TALLA]: ID.M }, COLOR, ID.Blanco)).toBe('disponible');
  });

  it('seleccionDe devuelve los valores de una variante; seleccionInicial elige los atributos de un solo valor', () => {
    const [primera] = MATRIZ;
    expect(primera && seleccionDe(primera)).toEqual({ [TALLA]: ID.S, [COLOR]: ID.Azul });

    const unSoloColor = [variante(8, 'S', 'Azul'), variante(9, 'M', 'Azul')];
    expect(seleccionInicial(atributosDe(unSoloColor))).toEqual({ [COLOR]: ID.Azul });
  });

  it('un producto sin atributos tiene una sola variante, que queda resuelta sin elegir nada', () => {
    const unica: Variante = { ...variante(9, 'S', 'Azul'), valores: [] };

    expect(atributosDe([unica])).toEqual([]);
    expect(varianteElegida([unica], {})?.idVariante).toBe(9);
  });

  it('precioMenor compara los montos como texto: 99.90 es menor que 249.00 y 1000.00 mayor', () => {
    const conPrecio = (idVariante: number, precio: string) => ({
      ...variante(idVariante, 'S', 'Azul'),
      precio,
    });

    expect(
      precioMenor([conPrecio(1, '249.00'), conPrecio(2, '99.90'), conPrecio(3, '1000.00')]),
    ).toBe('99.90');
    expect(precioMenor([])).toBeUndefined();
  });
});
