import { consultaExistenciasSchema, type OrdenExistencias } from '@shopcart/shared';
import { cn } from '../../../shared/ui/cn';
import { TablaServidor, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { AvisoConciliacion } from '../componentes/AvisoConciliacion';
import { FiltrosExistencias } from '../componentes/FiltrosExistencias';
import { useExistencias } from '../hooks/useExistencias';
import type { Existencia } from '../inventario.api';

const cantidad = (valor: number) => <span className="tabular-nums">{String(valor)}</span>;

const columnas: ColumnaTabla<Existencia, OrdenExistencias['orden']>[] = [
  {
    id: 'sku',
    etiqueta: 'SKU',
    prioridad: 1,
    ordenable: 'sku',
    celda: (e) => <span className="texto-pequeno-fuerte">{e.sku}</span>,
  },
  {
    id: 'producto',
    etiqueta: 'Producto',
    prioridad: 1,
    ordenable: 'producto',
    celda: (e) => `${e.producto}, ${e.descripcionAtributos}`,
  },
  {
    id: 'fisica',
    etiqueta: 'Física',
    prioridad: 2,
    alineacion: 'fin',
    celda: (e) => cantidad(e.existenciaFisica),
  },
  {
    id: 'reservado',
    etiqueta: 'Reservado',
    prioridad: 2,
    alineacion: 'fin',
    celda: (e) => cantidad(e.reservado),
  },
  {
    id: 'disponible',
    etiqueta: 'Disponible',
    prioridad: 1,
    alineacion: 'fin',
    ordenable: 'disponible',
    // El disponible lo calcula FU_Inventario_Disponible; la página solo marca el agotado.
    celda: (e) => (
      <span
        className={cn('texto-pequeno-fuerte tabular-nums', e.disponible === 0 && 'text-oferta')}
      >
        {String(e.disponible)}
      </span>
    ),
  },
];

/**
 * M7-H01 (Figma 48:1488): `/backoffice/inventario`, las existencias por variante con búsqueda, orden y
 * paginación del servidor (FE-06) y, arriba, la conciliación con el kardex (N-07). Operador y Administrador.
 */
export function InventarioPagina() {
  useTituloPagina('Inventario');
  const parametros = useParametrosUrl(consultaExistenciasSchema);
  const existencias = useExistencias(parametros.valores);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="display-titulo-1">Inventario</h1>
        <p className="texto-base text-muted-foreground">
          Existencias por variante, entradas, ajustes y kardex.
        </p>
      </div>
      <AvisoConciliacion />
      <TablaServidor
        titulo="Existencias"
        columnas={columnas}
        consulta={existencias}
        parametros={parametros}
        claveFila={(e) => e.idVariante}
        vacio={{
          titulo: 'Sin variantes que coincidan',
          descripcion: 'Prueba con otro SKU o nombre de producto.',
        }}
        filtros={<FiltrosExistencias parametros={parametros} />}
      />
    </div>
  );
}
