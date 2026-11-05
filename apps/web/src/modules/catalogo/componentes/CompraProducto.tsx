import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../shared/ui/button';

const CANTIDAD_MINIMA = 1;

interface PropsCompraProducto {
  /** Los atributos que faltan por elegir, en minúscula y en su orden («talla», «color»). */
  faltan: string[];
  agotada: boolean;
}

function textoDelBoton({ faltan, agotada }: PropsCompraProducto): string {
  if (faltan.length > 0) return `Elige ${faltan.join(' y ')}`;
  return agotada ? 'Agotado' : 'Agregar al carrito';
}

/**
 * Figma: Cantidad y «Agregar al carrito» (24:314; en móvil, la barra fija de 24:406). M2-H03: el botón queda
 * deshabilitado; la acción y el límite de la cantidad (el disponible, que decide el backend) llegan con M3.
 */
export function CompraProducto(props: PropsCompraProducto) {
  const [cantidad, setCantidad] = useState(CANTIDAD_MINIMA);
  return (
    <div className="bg-card fixed inset-x-0 bottom-0 z-10 flex gap-3 border-t p-4 md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
      <div className="bg-card flex items-center rounded-md border">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Quitar uno"
          disabled={cantidad <= CANTIDAD_MINIMA}
          onClick={() => {
            setCantidad((actual) => actual - 1);
          }}
        >
          <Minus aria-hidden />
        </Button>
        <output aria-label="Cantidad" className="texto-base-fuerte w-8 text-center">
          {cantidad}
        </output>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Agregar uno"
          onClick={() => {
            setCantidad((actual) => actual + 1);
          }}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      <Button type="button" disabled className="control-boton h-auto flex-1 px-6 py-3">
        {textoDelBoton(props)}
      </Button>
    </div>
  );
}
