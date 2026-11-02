import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { respuestaPaginadaSchema, z } from '../../../../src/shared/openapi/index.js';

const SRC = join(import.meta.dirname, '../../../../src');

describe('respuestaPaginadaSchema (sobre de los listados en OpenAPI)', () => {
  const pagina = respuestaPaginadaSchema(z.object({ id: z.number() }));

  it('describe los datos de la fila y la paginación de RespuestaPaginada', () => {
    const respuesta = {
      datos: [{ id: 1 }],
      paginacion: { pagina: 1, tamano: 20, total: 1, totalPaginas: 1 },
    };

    expect(pagina.parse(respuesta)).toEqual(respuesta);
  });

  it('los números de la paginación son enteros', () => {
    const respuesta = {
      datos: [],
      paginacion: { pagina: 1.5, tamano: 20, total: 0, totalPaginas: 0 },
    };

    expect(pagina.safeParse(respuesta).success).toBe(false);
  });

  it('es el único sobre de paginación: ningún archivo de rutas lo vuelve a declarar', () => {
    const rutas = readdirSync(join(SRC, 'modules'), { recursive: true, encoding: 'utf8' }).filter(
      (archivo) => archivo.endsWith('.routes.ts'),
    );

    const conSobrePropio = rutas.filter((archivo) =>
      readFileSync(join(SRC, 'modules', archivo), 'utf8').includes('totalPaginas'),
    );

    expect(conSobrePropio).toEqual([]);
  });
});
