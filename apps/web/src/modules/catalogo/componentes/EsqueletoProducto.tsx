import { RESERVA_BARRA_BOTON } from '../../../shared/ui/barra-fija';
import { cn } from '../../../shared/ui/cn';
import { Skeleton } from '../../../shared/ui/skeleton';

const MINIATURAS = 4;
const MUESTRAS = 4;
const TALLAS = 4;

/**
 * D3: el detalle de producto mientras carga, con la forma de FichaProducto: la ruta, la galería cuadrada con sus
 * miniaturas y, al lado, la categoría, el título, el precio, las muestras, las tallas y el botón.
 */
export const ESQUELETO_PRODUCTO = (
  <div className={cn('flex flex-col gap-6', RESERVA_BARRA_BOTON)}>
    <Skeleton className="hidden h-5 w-64 max-w-full md:block" />
    <div className="grid gap-6 md:grid-cols-2 md:gap-12">
      <div className="-mx-4 -mt-4 flex flex-col gap-3 md:mx-0 md:mt-0">
        <Skeleton className="aspect-square w-full rounded-none max-md:aspect-auto max-md:h-[min(100vw,45vh)] md:rounded-tarjeta" />
        <div className="flex gap-2 px-4 md:px-0">
          {Array.from({ length: MINIATURAS }, (_, indice) => (
            <Skeleton key={indice} className="size-16" />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8.5 w-3/4 md:h-10" />
          <Skeleton className="h-8.5 w-36 md:h-10" />
        </div>
        <hr />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-24" />
          <div className="flex gap-2">
            {Array.from({ length: MUESTRAS }, (_, indice) => (
              <Skeleton key={indice} className="size-10 rounded-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-16" />
          <div className="flex gap-2">
            {Array.from({ length: TALLAS }, (_, indice) => (
              <Skeleton key={indice} className="h-11 w-13" />
            ))}
          </div>
        </div>
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-18 w-full" />
      </div>
    </div>
  </div>
);
