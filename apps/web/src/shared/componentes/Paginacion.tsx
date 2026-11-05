import { formatearConteo } from '../formato/conteo';
import { Button } from '../ui/button';

/** La paginación que devuelve toda lista del backend (01 §5.1). */
export interface DatosPaginacion {
  pagina: number;
  tamano: number;
  total: number;
  totalPaginas: number;
}

interface PropsPaginacion {
  paginacion: DatosPaginacion;
  onPagina: (pagina: number) => void;
}

/** Figma: Paginación (20:257). El resumen sale de `paginacion` tal como lo manda el backend. */
export function Paginacion({
  paginacion: { pagina, total, totalPaginas },
  onPagina,
}: PropsPaginacion) {
  const ultima = Math.max(totalPaginas, 1);
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3">
      <p className="texto-pequeno text-muted-foreground">
        {`Página ${String(pagina)} de ${String(ultima)}, ${formatearConteo(total, 'resultado', 'resultados')}`}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pagina <= 1}
          onClick={() => {
            onPagina(pagina - 1);
          }}
        >
          Anterior
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pagina >= ultima}
          onClick={() => {
            onPagina(pagina + 1);
          }}
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
