import type { EstadoReembolso as Estado } from '@shopcart/shared';
import { cva } from 'class-variance-authority';

// N-09, N-10, E9-H04: el nombre para la persona y su tono; el color nunca es el único medio.
const ESTADOS: Record<Estado, { nombre: string; tono: 'info' | 'exito' | 'oferta' | 'apagado' }> = {
  Pendiente: { nombre: 'Pendiente', tono: 'info' },
  Completado: { nombre: 'Completado', tono: 'exito' },
  Fallido: { nombre: 'Fallido', tono: 'oferta' },
  ResueltoManual: { nombre: 'Resuelto a mano', tono: 'exito' },
  NoAplica: { nombre: 'No aplica', tono: 'apagado' },
};

export const nombreDelEstadoReembolso = (estado: Estado) => ESTADOS[estado].nombre;

const insignia = cva(
  'texto-pequeno-fuerte inline-flex items-center gap-1.5 rounded-full px-3 py-1 whitespace-nowrap',
  {
    variants: {
      tono: {
        info: 'bg-info-suave text-info',
        exito: 'bg-exito-suave text-exito',
        oferta: 'bg-destructive-suave text-oferta',
        apagado: 'bg-muted text-muted-foreground',
      },
    },
  },
);

/** M8-H05: el estado de un reembolso con la misma insignia que el estado del pedido (Figma 5:44). */
export function EstadoReembolso({ estado }: { estado: Estado }) {
  return (
    <span className={insignia({ tono: ESTADOS[estado].tono })}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {nombreDelEstadoReembolso(estado)}
    </span>
  );
}
