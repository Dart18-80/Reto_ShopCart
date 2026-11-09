import type { ReactNode } from 'react';
import { useMostrarTrasRetraso } from '../../../shared/hooks/useMostrarTrasRetraso';
import { cn } from '../../../shared/ui/cn';
import { Skeleton } from '../../../shared/ui/skeleton';
import type { ProductoBusqueda } from '../catalogo.api';
import { TarjetaProducto } from './TarjetaProducto';

const CLASES_CUADRICULA = 'grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-3';
const TARJETAS_DEL_ESQUELETO = 6;
// D2: la aparición escalonada dura 7 × 30 ms de retraso más 200 ms de la última tarjeta; después se quita, así
// las tarjetas que llegan con otra página o con otro filtro no vuelven a animar.
const DURACION_ESCALONADO_MS = 450;

function Cuadricula({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn(CLASES_CUADRICULA, className)}>{children}</ul>;
}

/** Figma 22:92: dos columnas en móvil y tres desde `lg`. */
export function CuadriculaProductos({ productos }: { productos: ProductoBusqueda[] }) {
  const yaAparecio = useMostrarTrasRetraso(DURACION_ESCALONADO_MS);
  return (
    <Cuadricula className={yaAparecio ? undefined : 'rejilla-escalonada'}>
      {productos.map((producto) => (
        <li key={producto.idProducto} className="flex">
          <TarjetaProducto producto={producto} />
        </li>
      ))}
    </Cuadricula>
  );
}

export const ESQUELETO_CUADRICULA = (
  <Cuadricula>
    {Array.from({ length: TARJETAS_DEL_ESQUELETO }, (_, indice) => (
      <li key={indice} className="flex">
        <div className="bg-card flex w-full flex-col overflow-hidden rounded-tarjeta border">
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="flex flex-col gap-1.5 p-4 md:p-5">
            <div className="mb-1 flex gap-1.5">
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="size-5 rounded-full" />
              <Skeleton className="size-5 rounded-full" />
            </div>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="hidden h-4 w-1/2 md:block" />
            <Skeleton className="h-5 w-20" />
            <div className="flex flex-col gap-0.5 pt-2">
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-7.5 w-24" />
            </div>
          </div>
        </div>
      </li>
    ))}
  </Cuadricula>
);
