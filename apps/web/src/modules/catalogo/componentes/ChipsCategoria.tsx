import { cn } from '../../../shared/ui/cn';
import type { Categoria } from '../catalogo.api';

interface PropsChipsCategoria {
  categorias: Categoria[];
  /** La categoría elegida; sin ninguna, «Todo». */
  seleccionada: number | undefined;
  onElegir: (idCategoria: number | undefined) => void;
}

function Chip({
  etiqueta,
  activo,
  onClick,
}: {
  etiqueta: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <li className="shrink-0">
      <button
        type="button"
        aria-pressed={activo}
        onClick={onClick}
        className={cn(
          'texto-pequeno-fuerte focus-visible:ring-ring rounded-full border px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none',
          activo
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-card text-foreground hover:border-primary',
        )}
      >
        {etiqueta}
      </button>
    </li>
  );
}

/** Figma: Chip (Categorías del catálogo, 22:42). En móvil la fila se desplaza a lo ancho. */
export function ChipsCategoria({ categorias, seleccionada, onElegir }: PropsChipsCategoria) {
  return (
    <nav aria-label="Categorías">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        <Chip
          etiqueta="Todo"
          activo={seleccionada === undefined}
          onClick={() => {
            onElegir(undefined);
          }}
        />
        {categorias.map((categoria) => (
          <Chip
            key={categoria.idCategoria}
            etiqueta={categoria.nombre}
            activo={seleccionada === categoria.idCategoria}
            onClick={() => {
              onElegir(categoria.idCategoria);
            }}
          />
        ))}
      </ul>
    </nav>
  );
}
