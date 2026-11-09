import type { IlustracionPrenda } from '@shopcart/shared';
import { useState } from 'react';
import { Prenda } from '../../../shared/componentes/prenda/Prenda';
import { cn } from '../../../shared/ui/cn';
import type { ProductoTienda } from '../catalogo.api';

type Imagen = ProductoTienda['imagenes'][number];

interface PropsGaleria {
  ilustracion: IlustracionPrenda;
  /** El color elegido (o el primero del producto): la ilustración se tiñe con él (FE-15). */
  color: string | undefined;
  imagenes: Imagen[];
}

const MINIATURA =
  'bg-muted focus-visible:ring-ring flex size-16 items-center justify-center overflow-hidden rounded-control border-2 focus-visible:ring-2 focus-visible:outline-none';

/**
 * Figma 24:314: la ilustración teñida primero; si el producto tiene imágenes, se eligen como miniaturas, cada una
 * con su texto alternativo (N-19).
 */
export function GaleriaProducto({ ilustracion, color, imagenes }: PropsGaleria) {
  const [elegida, setElegida] = useState<Imagen | null>(null);
  return (
    <section aria-label="Galería" className="flex flex-col gap-3">
      <div className="bg-muted flex aspect-square items-center justify-center overflow-hidden md:rounded-tarjeta">
        {elegida ? (
          <img
            src={elegida.url}
            alt={elegida.textoAlternativo}
            className="animar-fundido size-full object-contain"
          />
        ) : (
          <Prenda tipo={ilustracion} color={color} className="h-3/5 w-3/5" />
        )}
      </div>
      {imagenes.length > 0 && (
        <ul className="flex gap-2 px-4 md:px-0">
          <li>
            <button
              type="button"
              aria-label="Ver: ilustración"
              aria-pressed={elegida === null}
              onClick={() => {
                setElegida(null);
              }}
              className={cn(MINIATURA, elegida === null ? 'border-primary' : 'border-transparent')}
            >
              <Prenda tipo={ilustracion} color={color} className="size-12" />
            </button>
          </li>
          {imagenes.map((imagen) => (
            <li key={imagen.idImagenProducto}>
              <button
                type="button"
                aria-label={`Ver: ${imagen.textoAlternativo}`}
                aria-pressed={elegida?.idImagenProducto === imagen.idImagenProducto}
                onClick={() => {
                  setElegida(imagen);
                }}
                className={cn(
                  MINIATURA,
                  elegida?.idImagenProducto === imagen.idImagenProducto
                    ? 'border-primary'
                    : 'border-transparent',
                )}
              >
                <img src={imagen.url} alt="" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
