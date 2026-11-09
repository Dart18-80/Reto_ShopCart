import { EsqueletoPanel } from '../../../shared/componentes/EsqueletoPanel';
import { Skeleton } from '../../../shared/ui/skeleton';

const OPCIONES = 2;

/** D3: una lista de opciones (direcciones o métodos de envío) mientras carga, con la medida de `Opcion`. */
export const ESQUELETO_OPCIONES = (
  <div className="flex flex-col gap-3">
    {Array.from({ length: OPCIONES }, (_, indice) => (
      <div key={indice} className="bg-card flex items-start gap-3 rounded-control border p-4">
        <Skeleton className="mt-1 size-4 rounded-full" />
        <div className="flex flex-1 flex-col gap-0.5">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      </div>
    ))}
  </div>
);

function Seccion() {
  return (
    <section className="flex flex-col gap-3">
      <Skeleton className="h-7.5 w-56" />
      {ESQUELETO_OPCIONES}
    </section>
  );
}

/** D3: el paso de dirección y envío mientras carga: dos secciones de opciones y el resumen a la derecha. */
export const ESQUELETO_DIRECCION_Y_ENVIO = (
  <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-12">
    <div className="flex min-w-0 flex-1 flex-col gap-8">
      <Seccion />
      <Seccion />
    </div>
    <div className="md:w-105 md:shrink-0">
      <EsqueletoPanel filas={4} />
    </div>
  </div>
);

/** D3: el paso de pago mientras carga: el aviso de la reserva, los campos de la tarjeta, el botón y el resumen. */
export const ESQUELETO_PAGO = (
  <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-12">
    <div className="flex min-w-0 flex-1 flex-col gap-5">
      <Skeleton className="h-7.5 w-56" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-[auto_auto_1fr] gap-4">
        <Skeleton className="h-16 w-20" />
        <Skeleton className="h-16 w-24" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Skeleton className="h-11 w-full" />
    </div>
    <div className="md:w-105 md:shrink-0">
      <EsqueletoPanel filas={4} />
    </div>
  </div>
);
