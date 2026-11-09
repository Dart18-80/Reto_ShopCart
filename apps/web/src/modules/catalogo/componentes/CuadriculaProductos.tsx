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
      <li key={indice} className="flex flex-col gap-2">
        <Skeleton className="aspect-square w-full rounded-tarjeta" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
      </li>
    ))}
  </Cuadricula>
);
