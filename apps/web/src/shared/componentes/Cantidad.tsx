import { Minus, Plus } from 'lucide-react';
import { Button } from '../ui/button';

const CANTIDAD_MINIMA = 1;

interface PropsCantidad {
  valor: number;
  onCambiar: (cantidad: number) => void;
  /** Mientras el backend responde (sin optimismo) o si la línea ya no se puede comprar. */
  deshabilitada?: boolean;
  /** Para el lector de pantalla: «Cantidad de Camisa Oxford». */
  etiqueta?: string;
}

/**
 * Figma: Cantidad. Solo pide el cambio: el límite real es el disponible, que decide el backend (N-06); por eso
 * no hay máximo aquí.
 */
export function Cantidad({
  valor,
  onCambiar,
  deshabilitada = false,
  etiqueta = 'Cantidad',
}: PropsCantidad) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className="bg-card flex items-center rounded-control border"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Quitar uno"
        disabled={deshabilitada || valor <= CANTIDAD_MINIMA}
        onClick={() => {
          onCambiar(valor - 1);
        }}
      >
        <Minus aria-hidden />
      </Button>
      <output aria-label="Cantidad" className="texto-base-fuerte w-8 text-center">
        {valor}
      </output>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Agregar uno"
        disabled={deshabilitada}
        onClick={() => {
          onCambiar(valor + 1);
        }}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
