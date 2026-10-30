import { describe, expect, it } from 'vitest';
import {
  consultaPaginacionSchema,
  paginar,
  TAMANO_MAXIMO_PAGINA,
} from '../../../../src/shared/http/paginacion.js';

describe('paginar', () => {
  it('devuelve los datos con el formato estándar de paginación', () => {
    const respuesta = paginar(['a', 'b'], 45, { pagina: 2, tamano: 20 });

    expect(respuesta).toEqual({
      datos: ['a', 'b'],
      paginacion: { pagina: 2, tamano: 20, total: 45, totalPaginas: 3 },
    });
  });

  it('una página incompleta al final cuenta como página', () => {
    const { paginacion } = paginar([], 41, { pagina: 1, tamano: 20 });

    expect(paginacion.totalPaginas).toBe(3);
  });

  it('sin resultados devuelve cero páginas', () => {
    const { paginacion } = paginar([], 0, { pagina: 1, tamano: 20 });

    expect(paginacion.totalPaginas).toBe(0);
  });
});

describe('consultaPaginacionSchema', () => {
  it('usa la página 1 y 20 elementos por defecto', () => {
    expect(consultaPaginacionSchema.parse({})).toEqual({ pagina: 1, tamano: 20 });
  });

  it('convierte los textos de la query string a números', () => {
    expect(consultaPaginacionSchema.parse({ pagina: '3', tamano: '50' })).toEqual({
      pagina: 3,
      tamano: 50,
    });
  });

  it('rechaza una página menor que 1', () => {
    expect(consultaPaginacionSchema.safeParse({ pagina: '0' }).success).toBe(false);
  });

  it('rechaza un tamaño mayor que el máximo', () => {
    const resultado = consultaPaginacionSchema.safeParse({ tamano: TAMANO_MAXIMO_PAGINA + 1 });

    expect(resultado.success).toBe(false);
  });
});
