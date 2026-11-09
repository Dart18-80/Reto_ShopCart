import { useState, type AnimationEvent, type ReactNode } from 'react';
import { cn } from '../../../shared/ui/cn';
import { Skeleton } from '../../../shared/ui/skeleton';
import type { ProductoBusqueda } from '../catalogo.api';
import { TarjetaProducto } from './TarjetaProducto';

const CLASES_CUADRICULA = 'grid grid-cols-2 gap-3 md:gap-6 lg:grid-cols-3';
const TARJETAS_DEL_ESQUELETO = 6;
function Cuadricula({
  children,
  className,
  onAnimationEnd,
}: {
  children: ReactNode;
  className?: string;
  onAnimationEnd?: (evento: AnimationEvent<HTMLUListElement>) => void;
}) {
  return (
    <ul className={cn(CLASES_CUADRICULA, className)} onAnimationEnd={onAnimationEnd}>
      {children}
    </ul>
  );
}

/** Figma 22:92: dos columnas en móvil y tres desde `lg`. */
export function CuadriculaProductos({ productos }: { productos: ProductoBusqueda[] }) {
  // D2: la aparición escalonada (movimiento.css) se quita cuando termina la de la última tarjeta, así las que llegan
  // con otra página o con otro filtro no vuelven a animar. Sin duraciones aquí: las pone la hoja de estilos.
  const [yaAparecio, setYaAparecio] = useState(false);
  return (
    <Cuadricula
      className={yaAparecio ? undefined : 'rejilla-escalonada'}
      onAnimationEnd={(evento) => {
        if (evento.target === evento.currentTarget.lastElementChild) setYaAparecio(true);
      }}
    >
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
