import { cn } from '../ui/cn';
import { Skeleton } from '../ui/skeleton';

/**
 * D3: el esqueleto de un panel (tarjeta con título y filas de texto), con las medidas de las secciones de la
 * tienda: un título de 30 px y filas de 20 px separadas 14 px.
 */
export function EsqueletoPanel({ filas, className }: { filas: number; className?: string }) {
  return (
    <div className={cn('bg-card flex flex-col gap-3.5 rounded-tarjeta border p-6', className)}>
      <Skeleton className="h-7.5 w-1/3" />
      {Array.from({ length: filas }, (_, indice) => (
        <div key={indice} className="flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
