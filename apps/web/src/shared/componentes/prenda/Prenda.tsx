import { cn } from '../../ui/cn';
import { TRAZOS, type TipoPrenda } from './trazos';

// FE-15: el color de la variante es presentación, no una regla de negocio. Los nombres son los de la semilla
// (S004) y cada uno usa su variable de la colección Prenda de Figma (--prenda-*).
const CLASE_DEL_COLOR: Record<string, string> = {
  Negro: 'text-prenda-negro',
  Blanco: 'text-prenda-blanco',
  Gris: 'text-prenda-gris',
  Azul: 'text-prenda-azul',
  'Azul marino': 'text-prenda-azul-marino',
  Celeste: 'text-prenda-celeste',
  Rojo: 'text-prenda-rojo',
  Vino: 'text-prenda-vino',
  Rosado: 'text-prenda-rosado',
  Verde: 'text-prenda-verde',
  Mostaza: 'text-prenda-mostaza',
  Beige: 'text-prenda-beige',
  Café: 'text-prenda-cafe',
};
const COLOR_NEUTRO = 'text-muted-foreground';

interface PropsPrenda {
  tipo: TipoPrenda;
  /** El nombre del color de la variante, como lo guarda el catálogo («Azul marino»). */
  color: string;
  className?: string;
}

/** Figma: Prenda (7:20). La tela toma el color de la variante con `currentColor`. */
export function Prenda({ tipo, color, className }: PropsPrenda) {
  const { tela, costura } = TRAZOS[tipo];
  return (
    <svg
      role="img"
      aria-label={`${tipo} color ${color}`}
      width="200"
      height="200"
      viewBox="0 0 200 200"
      fill="none"
      className={cn(CLASE_DEL_COLOR[color] ?? COLOR_NEUTRO, className)}
    >
      {/* El contorno y la costura son los del componente de Figma. */}
      <path
        data-capa="tela"
        d={tela}
        fill="currentColor"
        stroke="#0A121F"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d={costura} stroke="white" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
