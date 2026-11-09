import { cva } from 'class-variance-authority';
import { ShieldCheck, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../ui/cn';

type TipoAviso = 'info' | 'advertencia' | 'error' | 'exito';

const fondo = cva('flex items-start gap-2.5', {
  variants: {
    // D5: una tarjeta informativa (borde y superficie) en lugar de la franja de color.
    forma: {
      franja: 'rounded-control px-4 py-3',
      tarjeta: 'rounded-tarjeta bg-card border p-4 shadow-xs',
    },
    tipo: {
      info: 'bg-info-suave',
      advertencia: 'bg-aviso-suave',
      error: 'bg-destructive-suave',
      exito: 'bg-exito-suave',
    },
  },
  // En la tarjeta la superficie es la de siempre: cn() deja este fondo sobre el del tipo.
  compoundVariants: [{ forma: 'tarjeta', className: 'bg-card' }],
});

const colorIcono = cva('size-5 shrink-0', {
  variants: {
    tipo: {
      info: 'text-info',
      advertencia: 'text-aviso',
      error: 'text-destructive',
      exito: 'text-exito',
    },
  },
});

interface PropsAviso {
  tipo: TipoAviso;
  /** Figma: el ícono se cambia por instancia; por defecto, el escudo. */
  icono?: LucideIcon;
  /** Botones a la derecha del texto (Reintentar). */
  acciones?: ReactNode;
  forma?: 'franja' | 'tarjeta';
  children: ReactNode;
}

/** Figma: Aviso (21:245). Un error se anuncia de inmediato (`role="alert"`); los demás, como estado. */
export function Aviso({
  tipo,
  icono: Icono = ShieldCheck,
  acciones,
  forma = 'franja',
  children,
}: PropsAviso) {
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={cn(fondo({ tipo, forma }))}>
      <Icono aria-hidden className={colorIcono({ tipo })} />
      <div className="texto-pequeno text-foreground flex-1">{children}</div>
      {acciones}
    </div>
  );
}
