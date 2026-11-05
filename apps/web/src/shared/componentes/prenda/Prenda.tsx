import type { IlustracionPrenda } from '@shopcart/shared';
import { cn } from '../../ui/cn';
import { clasesDelColor } from './colores';
import { TRAZOS } from './trazos';

// El nombre que se lee de cada ilustración (la base guarda «Pantalon», sin tilde).
const NOMBRE_DE_LA_PRENDA: Record<IlustracionPrenda, string> = {
  Camisa: 'Camisa',
  Pantalon: 'Pantalón',
  Vestido: 'Vestido',
  Chaqueta: 'Chaqueta',
  Tenis: 'Tenis',
  Gorra: 'Gorra',
};

interface PropsPrenda {
  tipo: IlustracionPrenda;
  /** El nombre del color de la variante, como lo guarda el catálogo («Azul marino»); sin color, un neutro. */
  color?: string;
  className?: string;
}

/** Figma: Prenda (7:20). La tela toma el color de la variante con `currentColor`. */
export function Prenda({ tipo, color, className }: PropsPrenda) {
  const { tela, costura } = TRAZOS[tipo];
  const nombre = NOMBRE_DE_LA_PRENDA[tipo];
  return (
    <svg
      role="img"
      aria-label={color === undefined ? nombre : `${nombre} color ${color}`}
      width="200"
      height="200"
      viewBox="0 0 200 200"
      fill="none"
      className={cn(clasesDelColor(color).texto, className)}
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
