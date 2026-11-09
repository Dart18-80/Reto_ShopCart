import { describe, expect, it } from 'vitest';
import {
  formatearEscala,
  puntosDeCategorias,
  puntosDeTop,
  puntosDeVentas,
  TEXTO_NETO_CON_DEVOLUCIONES,
} from './graficas';

const ventas = [
  { periodo: '2026-11-02', ventas: '1500.50', pedidos: 3 },
  { periodo: '2026-11-03', ventas: '-120.00', pedidos: 0 },
];

describe('puntosDeVentas (M11-H01)', () => {
  it('en quetzales, el número solo dibuja la barra; lo que se lee sale del texto del backend', () => {
    const [primero] = puntosDeVentas(ventas, 'dia', 'quetzales');

    expect(primero).toEqual({
      clave: '2026-11-02',
      etiqueta: '2 nov',
      titulo: '2 nov 2026',
      valor: 1500.5,
      detalle: 'Q1,500.50 · 3 pedidos',
      negativo: false,
    });
  });

  it('un periodo con ventas negativas (solo devoluciones, N-11) queda marcado', () => {
    const [, segundo] = puntosDeVentas(ventas, 'dia', 'quetzales');

    expect(segundo).toMatchObject({ valor: -120, negativo: true, detalle: '-Q120.00 · 0 pedidos' });
  });

  it('en pedidos, la barra es el conteo y nunca es negativa', () => {
    const puntos = puntosDeVentas(ventas, 'dia', 'pedidos');

    expect(puntos.map((p) => [p.valor, p.negativo])).toEqual([
      [3, false],
      [0, false],
    ]);
  });

  it('la semana se nombra por su lunes y el mes por su mes', () => {
    expect(puntosDeVentas(ventas, 'semana', 'quetzales')[0]).toMatchObject({
      etiqueta: '2 nov',
      titulo: 'Semana del 2 nov 2026',
    });
    expect(
      puntosDeVentas(
        [{ periodo: '2026-11-01', ventas: '0.00', pedidos: 0 }],
        'mes',
        'quetzales',
      )[0],
    ).toMatchObject({ etiqueta: 'nov 2026', titulo: 'nov 2026' });
  });
});

describe('puntosDeCategorias y puntosDeTop (M11-H01)', () => {
  it('las categorías se miden en quetzales, en el orden del backend', () => {
    const puntos = puntosDeCategorias([
      { idCategoria: 4, categoria: 'Camisas', unidades: 12, ventas: '980.00' },
      { idCategoria: 2, categoria: 'Gorras', unidades: 1, ventas: '-35.00' },
    ]);

    expect(puntos).toEqual([
      {
        clave: '4',
        etiqueta: 'Camisas',
        titulo: 'Camisas',
        valor: 980,
        detalle: 'Q980.00 · 12 unidades',
        negativo: false,
      },
      {
        clave: '2',
        etiqueta: 'Gorras',
        titulo: 'Gorras',
        valor: -35,
        detalle: '-Q35.00 · 1 unidad',
        negativo: true,
      },
    ]);
  });

  it('el top 10 se mide en unidades, como lo ordena el backend', () => {
    const [punto] = puntosDeTop([
      { idProducto: 9, producto: 'Camisa Oxford', unidades: 7, ventas: '1050.00' },
    ]);

    expect(punto).toMatchObject({
      clave: '9',
      etiqueta: 'Camisa Oxford',
      valor: 7,
      detalle: '7 unidades · Q1,050.00',
    });
  });
});

describe('formatearEscala', () => {
  it('en quetzales, las marcas del eje se abrevian y llevan el símbolo, como formatearMonto', () => {
    expect(formatearEscala(1500, 'quetzales')).toBe('Q1.5K');
    expect(formatearEscala(-200, 'quetzales')).toBe('-Q200');
  });

  it('un conteo se escribe entero, con separador de miles', () => {
    expect(formatearEscala(12, 'conteo')).toBe('12');
    expect(formatearEscala(1500, 'conteo')).toBe('1,500');
  });
});

it('la etiqueta de los negativos es la de 05 §11', () => {
  expect(TEXTO_NETO_CON_DEVOLUCIONES).toBe('Neto con devoluciones');
});
