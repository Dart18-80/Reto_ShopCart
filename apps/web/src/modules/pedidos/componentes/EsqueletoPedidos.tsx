import { EsqueletoPanel } from '../../../shared/componentes/EsqueletoPanel';
import { Skeleton } from '../../../shared/ui/skeleton';

const PEDIDOS = 3;

/** D3: mis pedidos mientras cargan, con la medida de TarjetaPedido. */
export const ESQUELETO_MIS_PEDIDOS = (
  <ul className="flex flex-col gap-3">
    {Array.from({ length: PEDIDOS }, (_, indice) => (
      <li
        key={indice}
        className="bg-card flex flex-wrap items-center gap-x-4 gap-y-2 rounded-tarjeta border px-6 py-4"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-5 w-1/3" />
        </div>
        <Skeleton className="h-6 w-24" />
      </li>
    ))}
  </ul>
);

/** D3: el detalle de un pedido mientras carga: la ruta, el título y las dos columnas de secciones. */
export const ESQUELETO_PEDIDO = (
  <div className="flex flex-col gap-6">
    <Skeleton className="h-5 w-48" />
    <Skeleton className="h-8.5 w-72 max-w-full md:h-10" />
    <div className="grid items-start gap-6 md:grid-cols-[1fr_19rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <EsqueletoPanel filas={4} />
        <EsqueletoPanel filas={3} />
      </div>
      <div className="flex flex-col gap-6">
        <EsqueletoPanel filas={2} />
        <EsqueletoPanel filas={2} />
      </div>
    </div>
  </div>
);
