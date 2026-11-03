import type { UseQueryResult } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { ParametrosUrl } from '../hooks/useParametrosUrl';
import { TablaServidor, type ColumnaTabla, type RespuestaPaginada } from './TablaServidor';

// Estas pruebas las verifica `tsc` (pnpm typecheck): cada @ts-expect-error falla el chequeo si deja de haber error.

interface Fila {
  id: number;
  total: string;
}
interface ConsultaPedidos {
  pagina: number;
  tamano: number;
  orden: 'fecha' | 'total';
  direccion: 'asc' | 'desc';
}

describe('TablaServidor: tipos', () => {
  it('ordenable solo acepta valores del enum de orden', () => {
    const columnas: ColumnaTabla<Fila, ConsultaPedidos['orden']>[] = [
      { id: 'total', etiqueta: 'Total', celda: (f) => f.total, ordenable: 'total', prioridad: 1 },
      {
        id: 'cliente',
        etiqueta: 'Cliente',
        celda: (f) => f.id,
        // @ts-expect-error 'cliente' no está en la lista blanca de orden del backend.
        ordenable: 'cliente',
        prioridad: 2,
      },
    ];

    expect(columnas).toHaveLength(2);
  });

  it('la tabla rechaza columnas ordenables por un orden que su consulta no tiene', () => {
    const montar = (
      consulta: UseQueryResult<RespuestaPaginada<Fila>>,
      parametros: ParametrosUrl<ConsultaPedidos>,
      columnasDeOtraConsulta: ColumnaTabla<Fila, 'nombre'>[],
    ) => (
      <TablaServidor
        titulo="Pedidos"
        // @ts-expect-error las columnas ordenan por 'nombre' y la consulta solo por 'fecha' o 'total'.
        columnas={columnasDeOtraConsulta}
        consulta={consulta}
        parametros={parametros}
        claveFila={(f) => f.id}
        vacio={{ titulo: 'Sin pedidos' }}
      />
    );

    expect(montar).toBeTypeOf('function');
  });
});
