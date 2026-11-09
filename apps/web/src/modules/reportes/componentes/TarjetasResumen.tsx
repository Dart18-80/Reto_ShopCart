import type { RangoDeFechas } from '@shopcart/shared';
import type { ReactNode } from 'react';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { Monto } from '../../../shared/componentes/Monto';
import { formatearCantidad } from '../../../shared/formato/conteo';
import { formatearFechaCalendario } from '../../../shared/formato/fecha';
import { Skeleton } from '../../../shared/ui/skeleton';
import { DialogoExportar } from '../../exportaciones';
import { useResumen } from '../hooks/useReportes';
import type { Resumen } from '../reportes.api';
import { MontoNeto } from './MontoNeto';
import {
  Package,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  TrendingDown,
  Truck,
  Undo2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../../shared/ui/cn';

type Tono = 'primario' | 'info' | 'exito' | 'aviso' | 'oferta';

interface Tarjeta {
  etiqueta: string;
  cifra: (resumen: Resumen) => ReactNode;
  nota?: string;
  /** D6: el ícono y su círculo de color (decorativos). */
  icono: LucideIcon;
  tono: Tono;
}

const CIRCULO: Record<Tono, string> = {
  primario: 'bg-secondary text-secondary-foreground',
  info: 'bg-info-suave text-info',
  exito: 'bg-exito-suave text-exito',
  aviso: 'bg-aviso-suave text-aviso',
  oferta: 'bg-destructive-suave text-oferta',
};

// RF-08 y N-11: lo que el resumen trae, en el orden en que se lee.
const TARJETAS: readonly Tarjeta[] = [
  {
    etiqueta: 'Ventas netas',
    cifra: (r) => <MontoNeto valor={r.ventas} />,
    nota: 'Con IVA, sin envío y menos devoluciones',
    icono: Wallet,
    tono: 'primario',
  },
  {
    etiqueta: 'Pedidos',
    cifra: (r) => formatearCantidad(r.pedidos),
    icono: ShoppingBag,
    tono: 'info',
  },
  {
    etiqueta: 'Ticket promedio',
    cifra: (r) => <MontoNeto valor={r.ticketPromedio} />,
    icono: Receipt,
    tono: 'primario',
  },
  {
    etiqueta: 'Unidades vendidas',
    cifra: (r) => formatearCantidad(r.unidades),
    icono: Package,
    tono: 'exito',
  },
  {
    etiqueta: 'Devoluciones',
    cifra: (r) => <Monto valor={r.devoluciones} />,
    icono: Undo2,
    tono: 'oferta',
  },
  {
    etiqueta: 'Envío cobrado',
    cifra: (r) => <Monto valor={r.envio} />,
    icono: Truck,
    tono: 'info',
  },
  {
    etiqueta: 'Carritos abandonados',
    cifra: (r) => formatearCantidad(r.carritosAbandonados),
    icono: ShoppingCart,
    tono: 'aviso',
  },
  {
    etiqueta: 'Monto potencial perdido',
    cifra: (r) => <Monto valor={r.montoPotencialPerdido} />,
    icono: TrendingDown,
    tono: 'oferta',
  },
];

// Una columna en teléfonos: un monto de millones no cabe en media pantalla con la cifra del tamaño de las tarjetas.
const CLASE_REJILLA = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4';

const ESQUELETO = (
  <div className={CLASE_REJILLA}>
    {TARJETAS.map((tarjeta) => (
      <Skeleton key={tarjeta.etiqueta} className="h-28 w-full" />
    ))}
  </div>
);

/** FE-07: el resumen del periodo en tarjetas de KPI, con el rango que el backend usó (sin rango, 30 días). */
export function TarjetasResumen({ rango }: { rango: RangoDeFechas }) {
  const resumen = useResumen(rango);
  return (
    <section aria-label="Resumen del periodo" className="flex flex-col gap-3">
      <EstadoVista consulta={resumen} esqueleto={ESQUELETO}>
        {(datos) => (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="texto-pequeno text-muted-foreground" aria-live="polite">
                Del {formatearFechaCalendario(datos.desde)} al{' '}
                {formatearFechaCalendario(datos.hasta)}
              </p>
              <DialogoExportar reporte="resumen" filtros={rango} />
            </div>
            <dl className={CLASE_REJILLA}>
              {TARJETAS.map(({ etiqueta, cifra, nota, icono: Icono, tono }) => (
                <div
                  key={etiqueta}
                  className="bg-card flex flex-col gap-1 rounded-tarjeta border p-4 shadow-xs md:p-5"
                >
                  <dt className="texto-pequeno text-muted-foreground flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full',
                        CIRCULO[tono],
                      )}
                    >
                      <Icono className="size-4" />
                    </span>
                    {etiqueta}
                  </dt>
                  <dd className="titulo-2 tabular-nums">{cifra(datos)}</dd>
                  {nota && <dd className="texto-nota text-muted-foreground">{nota}</dd>}
                </div>
              ))}
            </dl>
          </>
        )}
      </EstadoVista>
    </section>
  );
}
