import { cva } from 'class-variance-authority';
import type { EstadoTiempoReal } from '../tiempoReal';

const TEXTO: Record<EstadoTiempoReal, string> = {
  conectando: 'Conectando…',
  'en-vivo': 'En vivo',
  reconectando: 'Reconectando…',
  'en-pausa': 'En pausa',
};

const DETALLE: Record<EstadoTiempoReal, string> = {
  conectando: 'Abriendo la conexión de tiempo real.',
  'en-vivo': 'Las cifras se actualizan solas cuando hay ventas o carritos nuevos.',
  reconectando: 'Se perdió la conexión; las cifras siguen visibles y se actualizan al volver.',
  'en-pausa':
    'Tiempo real en pausa: las cifras se actualizan al cambiar los filtros o al recargar.',
};

const punto = cva('inline-block size-2 shrink-0 rounded-full', {
  variants: {
    estado: {
      conectando: 'bg-muted-foreground',
      'en-vivo': 'bg-exito',
      reconectando: 'bg-aviso animate-pulse',
      'en-pausa': 'bg-muted-foreground',
    },
  },
});

/**
 * FE-11 (05 §11): el estado del tiempo real siempre a la vista, con texto (nunca solo el color del punto). Se anuncia
 * a los lectores de pantalla cuando cambia.
 */
export function IndicadorTiempoReal({ estado }: { estado: EstadoTiempoReal }) {
  return (
    <p
      role="status"
      title={DETALLE[estado]}
      className="texto-pequeno text-muted-foreground inline-flex items-center gap-2"
    >
      <span aria-hidden className={punto({ estado })} />
      <span>{TEXTO[estado]}</span>
      <span className="sr-only">. {DETALLE[estado]}</span>
    </p>
  );
}
