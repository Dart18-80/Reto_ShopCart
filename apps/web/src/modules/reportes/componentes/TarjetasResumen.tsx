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

interface Tarjeta {
  etiqueta: string;
  cifra: (resumen: Resumen) => ReactNode;
  nota?: string;
}

// RF-08 y N-11: lo que el resumen trae, en el orden en que se lee.
const TARJETAS: readonly Tarjeta[] = [
  {
    etiqueta: 'Ventas netas',
    cifra: (r) => <MontoNeto valor={r.ventas} />,
    nota: 'Con IVA, sin envío y menos devoluciones',
  },
  { etiqueta: 'Pedidos', cifra: (r) => formatearCantidad(r.pedidos) },
  { etiqueta: 'Ticket promedio', cifra: (r) => <MontoNeto valor={r.ticketPromedio} /> },
  { etiqueta: 'Unidades vendidas', cifra: (r) => formatearCantidad(r.unidades) },
  { etiqueta: 'Devoluciones', cifra: (r) => <Monto valor={r.devoluciones} /> },
  { etiqueta: 'Envío cobrado', cifra: (r) => <Monto valor={r.envio} /> },
  { etiqueta: 'Carritos abandonados', cifra: (r) => formatearCantidad(r.carritosAbandonados) },
  {
    etiqueta: 'Monto potencial perdido',
    cifra: (r) => <Monto valor={r.montoPotencialPerdido} />,
  },
];

// Una columna en teléfonos: un monto de millones no cabe en media pantalla con la cifra del tamaño de las tarjetas.
const CLASE_REJILLA = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4';

const ESQUELETO = (
  <div className={CLASE_REJILLA}>
    {TARJETAS.map((tarjeta) => (
      <Skeleton key={tarjeta.etiqueta} className="h-24 w-full" />
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
              {TARJETAS.map(({ etiqueta, cifra, nota }) => (
                <div key={etiqueta} className="bg-card flex flex-col gap-1 rounded-lg border p-4">
                  <dt className="texto-pequeno text-muted-foreground">{etiqueta}</dt>
                  <dd className="display-titulo-3 tabular-nums">{cifra(datos)}</dd>
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
