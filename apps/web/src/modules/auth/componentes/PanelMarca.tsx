import { Prenda } from '../../../shared/componentes/prenda/Prenda';
import { cn } from '../../../shared/ui/cn';

/**
 * D4: el panel decorativo de Ingresar y Registro desde 1024 px: azul marino, la franja diagonal azul y roja, el
 * logotipo y tres prendas teñidas. Todo es decoración (`aria-hidden`): el formulario no depende de nada de aquí.
 */
export function PanelMarca({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'bg-marca-azul-marino relative flex-col justify-between gap-10 overflow-hidden p-10 text-white',
        className,
      )}
    >
      <span className="franja-marca absolute inset-y-0 right-0 w-full [--franja-azul:var(--marca-celeste)]" />
      <span className="titulo-2 relative">ShopCart</span>
      <div className="relative flex items-end gap-4">
        <Prenda tipo="Camisa" color="Celeste" className="size-28" />
        <Prenda tipo="Chaqueta" color="Blanco" className="size-36" />
        <Prenda tipo="Tenis" color="Rojo" className="size-24" />
      </div>
    </div>
  );
}
