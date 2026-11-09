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
    <li className="shrink-0 snap-start">
      <button
        type="button"
        aria-pressed={activo}
        onClick={onClick}
        className={cn(
          'texto-pequeno-fuerte focus-visible:ring-ring min-h-11 rounded-full border px-4 transition-colors focus-visible:ring-2 focus-visible:outline-none',
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
    // D4: en móvil la fila se desplaza con scroll-snap y se desvanece en los bordes para indicar que hay más.
    <nav aria-label="Categorías">
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 [mask-image:linear-gradient(to_right,transparent,black_1rem,black_calc(100%-2rem),transparent)] md:mx-0 md:flex-wrap md:px-0 md:[mask-image:none]">
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
