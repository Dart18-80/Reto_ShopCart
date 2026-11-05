import { cva } from 'class-variance-authority';

type Tono = 'info' | 'aviso' | 'secundario' | 'exito' | 'apagado' | 'oferta';

// Los códigos de EstadoPedido (semilla S001) con su nombre para la persona; el color nunca es el único medio.
const ESTADOS: Record<string, { nombre: string; tono: Tono }> = {
  Pagado: { nombre: 'Pagado', tono: 'info' },
  EnPreparacion: { nombre: 'En preparación', tono: 'aviso' },
  Despachado: { nombre: 'Despachado', tono: 'secundario' },
  Entregado: { nombre: 'Entregado', tono: 'exito' },
  Cancelado: { nombre: 'Cancelado', tono: 'apagado' },
  DevueltoParcial: { nombre: 'Devuelto parcial', tono: 'oferta' },
  Devuelto: { nombre: 'Devuelto', tono: 'oferta' },
};

/** El nombre de un estado para la persona («En preparación»); un código desconocido se muestra tal cual. */
export const nombreDelEstado = (codigo: string): string => ESTADOS[codigo]?.nombre ?? codigo;

const insignia = cva(
  'texto-pequeno-fuerte inline-flex items-center gap-1.5 rounded-full px-3 py-1 whitespace-nowrap',
  {
    variants: {
      tono: {
        info: 'bg-info-suave text-info',
        aviso: 'bg-aviso-suave text-aviso',
        secundario: 'bg-secondary text-secondary-foreground',
        exito: 'bg-exito-suave text-exito',
        apagado: 'bg-muted text-muted-foreground',
        oferta: 'bg-destructive-suave text-oferta',
      },
    },
  },
);

/** Figma: Estado de pedido (5:44), con texto siempre (RF-07). La comparten la tienda y el backoffice. */
export function EstadoPedido({ estado }: { estado: string }) {
  return (
    <span className={insignia({ tono: ESTADOS[estado]?.tono ?? 'apagado' })}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {nombreDelEstado(estado)}
    </span>
  );
}
