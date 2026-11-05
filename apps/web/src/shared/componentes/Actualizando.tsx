import { LoaderCircle } from 'lucide-react';

/** FE-06: mientras llega la página nueva de un listado, se anuncia sin quitar la anterior. */
export function Actualizando({ activo }: { activo: boolean }) {
  return (
    <div aria-live="polite" className="texto-nota text-muted-foreground min-h-4">
      {activo && (
        <span className="inline-flex items-center gap-1.5">
          <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
          Actualizando…
        </span>
      )}
    </div>
  );
}
