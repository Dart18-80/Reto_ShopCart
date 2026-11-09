import { cn } from '../ui/cn';

/**
 * D3: barra de 2 px que avanza mientras algo carga. Es decorativa: quien la muestra anuncia la carga con texto
 * (`Actualizando…`, `Cargando…`). Con movimiento reducido se queda quieta (movimiento.css).
 */
export function BarraProgreso({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('barra-progreso bg-primary/15 h-0.5 overflow-hidden', className)}
    >
      <span className="bg-primary block h-full w-2/5" />
    </div>
  );
}
