import type { ReactNode } from 'react';
import { cn } from '../../../shared/ui/cn';

export interface ColumnaDeGrafica<T> {
  etiqueta: string;
  celda: (fila: T) => ReactNode;
  /** Las cifras a la derecha. */
  cifra?: boolean;
}

/** «Ver como tabla» (05 §11): los mismos datos de la gráfica, legibles sin depender del color ni de la geometría. */
export function TablaDeGrafica<T>({
  titulo,
  columnas,
  filas,
  claveFila,
}: {
  titulo: string;
  columnas: readonly ColumnaDeGrafica<T>[];
  filas: readonly T[];
  claveFila: (fila: T) => string | number;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table aria-label={titulo} className="w-full border-collapse text-left">
        <thead className="bg-muted">
          <tr>
            {columnas.map((columna) => (
              <th
                key={columna.etiqueta}
                className={cn(
                  'texto-pequeno-fuerte text-muted-foreground px-4 py-3',
                  columna.cifra && 'text-right',
                )}
              >
                {columna.etiqueta}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={claveFila(fila)} className="border-t">
              {columnas.map((columna) => (
                <td
                  key={columna.etiqueta}
                  className={cn(
                    'texto-pequeno px-4 py-3',
                    columna.cifra && 'text-right tabular-nums',
                  )}
                >
                  {columna.celda(fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
