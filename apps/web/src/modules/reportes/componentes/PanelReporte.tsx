import type { UseQueryResult } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';
import { Actualizando } from '../../../shared/componentes/Actualizando';
import { EstadoVista, type ContenidoVacio } from '../../../shared/componentes/EstadoVista';
import { Button } from '../../../shared/ui/button';

interface PropsPanelReporte<T> {
  titulo: string;
  descripcion?: string;
  consulta: UseQueryResult<T[]>;
  vacio: ContenidoVacio;
  /** Los selectores propios del reporte (la agrupación y la métrica de las ventas). */
  controles?: ReactNode;
  grafica: (filas: T[]) => ReactNode;
  tabla: (filas: T[]) => ReactNode;
}

/**
 * 05 §11: un reporte del dashboard con sus propios estados de carga, vacío y error (uno que falla no tumba a los
 * demás) y «Ver como tabla» con los mismos datos. Ver la gráfica o la tabla es una preferencia de la vista, no un
 * filtro: no va en la URL.
 */
export function PanelReporte<T>({
  titulo,
  descripcion,
  consulta,
  vacio,
  controles,
  grafica,
  tabla,
}: PropsPanelReporte<T>) {
  const idTitulo = useId();
  const [comoTabla, setComoTabla] = useState(false);

  return (
    <section
      aria-labelledby={idTitulo}
      className="bg-card flex min-w-0 flex-col gap-4 rounded-lg border p-4 md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={idTitulo} className="display-titulo-3">
            {titulo}
          </h2>
          {descripcion && <p className="texto-pequeno text-muted-foreground">{descripcion}</p>}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setComoTabla((actual) => !actual);
          }}
        >
          {comoTabla ? 'Ver como gráfica' : 'Ver como tabla'}
        </Button>
      </div>
      {controles}
      <Actualizando activo={consulta.isPlaceholderData} />
      <EstadoVista consulta={consulta} vacio={vacio} esVacio={(filas) => filas.length === 0}>
        {(filas) => (comoTabla ? tabla(filas) : grafica(filas))}
      </EstadoVista>
    </section>
  );
}
