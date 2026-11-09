import { EsqueletoPanel } from '../../../shared/componentes/EsqueletoPanel';
import { Skeleton } from '../../../shared/ui/skeleton';

const LINEAS = 2;

/** D3: el carrito mientras carga, con la forma de sus líneas (FilaCarrito) y el resumen a la derecha. */
export const ESQUELETO_CARRITO = (
  <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-12">
    <ul className="flex min-w-0 flex-1 flex-col gap-3">
      {Array.from({ length: LINEAS }, (_, indice) => (
        <li key={indice} className="bg-card rounded-tarjeta flex gap-4 border p-4 md:p-5">
          <Skeleton className="size-24 shrink-0 md:h-28" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-1 flex-col gap-1">
                <Skeleton className="h-6 w-1/2" />
                <Skeleton className="h-5 w-1/3" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
            <Skeleton className="h-11 w-36" />
          </div>
        </li>
      ))}
    </ul>
    <div className="md:w-100 md:shrink-0">
      <EsqueletoPanel filas={4} />
    </div>
  </div>
);
