import type { IlustracionPrenda } from '@shopcart/shared';
import type { LucideIcon } from 'lucide-react';
import { Prenda } from './Prenda';

/**
 * D5: la prenda de los estados vacíos y de error de la tienda, sobre un círculo suave y, si se pide, con el ícono
 * del aviso en una esquina. Es decoración: el título y la explicación ya dicen qué pasa.
 */
export function IlustracionDecorativa({
  tipo,
  icono: Icono,
}: {
  tipo: IlustracionPrenda;
  icono?: LucideIcon;
}) {
  return (
    <div
      aria-hidden
      className="bg-secondary relative mb-2 flex size-28 items-center justify-center rounded-full"
    >
      <Prenda tipo={tipo} className="size-20" />
      {Icono && (
        <span className="bg-card text-muted-foreground absolute -right-1 -bottom-1 flex size-10 items-center justify-center rounded-full border shadow-xs">
          <Icono className="size-5" />
        </span>
      )}
    </div>
  );
}
