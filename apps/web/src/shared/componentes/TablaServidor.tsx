import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, LoaderCircle } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import type { ModoHistorial, ParametrosUrl } from '../hooks/useParametrosUrl';
import { usePantallaAncha } from '../hooks/usePantallaAncha';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';
import { Skeleton } from '../ui/skeleton';
import { EstadoVista, type ContenidoVacio } from './EstadoVista';
import { Paginacion, type DatosPaginacion } from './Paginacion';

export interface ColumnaTabla<T, Orden extends string> {
  id: string;
  etiqueta: string;
  celda: (fila: T) => ReactNode;
  /** 1: también se ve en la tarjeta bajo `md`. */
  prioridad: 1 | 2 | 3;
  /** Solo valores del `enum` de `orden` del esquema: lo que la lista blanca del backend acepta (FE-06). */
  ordenable?: Orden;
  /** Montos a la derecha (Figma: Fila de tabla · Pedido). */
  alineacion?: 'inicio' | 'fin';
}

export interface RespuestaPaginada<T> {
  datos: T[];
  paginacion: DatosPaginacion;
}

/** Lo que toda consulta de tabla tiene (01 §5.1). */
export interface ConsultaTabla {
  pagina: number;
  tamano: number;
  orden?: string;
  direccion?: 'asc' | 'desc';
}

interface PropsTablaServidor<T, C extends ConsultaTabla> {
  /** Nombre accesible de la tabla o de la lista de tarjetas. */
  titulo: string;
  columnas: readonly ColumnaTabla<T, NonNullable<C['orden']>>[];
  consulta: UseQueryResult<RespuestaPaginada<T>>;
  parametros: ParametrosUrl<C>;
  claveFila: (fila: T) => string | number;
  /** Cuando todavía no hay registros; con filtros activos, la tabla muestra su propio vacío. */
  vacio: ContenidoVacio;
  /** Los controles de filtro, que escriben con `parametros.cambiar`. */
  filtros?: ReactNode;
}

type CambiarVista = (cambios: Partial<ConsultaTabla>, historial?: ModoHistorial) => void;

const FILAS_ESQUELETO = 5;

const ESQUELETO = (
  <div className="bg-card flex flex-col gap-4 rounded-lg border p-4">
    {Array.from({ length: FILAS_ESQUELETO }, (_, i) => (
      <Skeleton key={i} className="h-5 w-full" />
    ))}
  </div>
);

function Encabezado<T>({
  columna,
  orden,
  direccion,
  cambiarVista,
}: {
  columna: ColumnaTabla<T, string>;
  orden: string | undefined;
  direccion: 'asc' | 'desc' | undefined;
  cambiarVista: CambiarVista;
}) {
  const clases = cn(
    'texto-pequeno-fuerte text-muted-foreground h-auto px-4 py-3',
    columna.alineacion === 'fin' && 'text-right',
  );
  if (!columna.ordenable) return <th className={clases}>{columna.etiqueta}</th>;

  const activa = orden === columna.ordenable;
  const Flecha = direccion === 'desc' ? ArrowDown : ArrowUp;
  const ordenar = () => {
    cambiarVista({
      orden: columna.ordenable,
      direccion: activa && direccion === 'asc' ? 'desc' : 'asc',
    });
  };
  return (
    <th
      aria-sort={activa ? (direccion === 'desc' ? 'descending' : 'ascending') : 'none'}
      className={cn(clases, activa && 'text-foreground')}
    >
      <button
        type="button"
        onClick={ordenar}
        className="focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-[3px]"
      >
        {columna.etiqueta}
        {activa && <Flecha aria-hidden className="size-3.5" />}
      </button>
    </th>
  );
}

function Tabla<T>({
  titulo,
  columnas,
  filas,
  claveFila,
  actualizando,
  orden,
  direccion,
  cambiarVista,
}: {
  titulo: string;
  columnas: readonly ColumnaTabla<T, string>[];
  filas: T[];
  claveFila: (fila: T) => string | number;
  actualizando: boolean;
  orden: string | undefined;
  direccion: 'asc' | 'desc' | undefined;
  cambiarVista: CambiarVista;
}) {
  return (
    <div className="bg-card overflow-x-auto rounded-lg border">
      <table
        aria-label={titulo}
        aria-busy={actualizando}
        className="w-full border-collapse text-left"
      >
        <thead className="bg-muted">
          <tr>
            {columnas.map((columna) => (
              <Encabezado
                key={columna.id}
                columna={columna}
                orden={orden}
                direccion={direccion}
                cambiarVista={cambiarVista}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr key={claveFila(fila)} className="border-t">
              {columnas.map((columna) => (
                <td
                  key={columna.id}
                  className={cn(
                    'texto-pequeno px-4 py-3',
                    columna.alineacion === 'fin' && 'text-right',
                  )}
                >
                  {columna.celda(fila)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tarjetas<T>({
  titulo,
  columnas,
  filas,
  claveFila,
  actualizando,
}: {
  titulo: string;
  columnas: readonly ColumnaTabla<T, string>[];
  filas: T[];
  claveFila: (fila: T) => string | number;
  actualizando: boolean;
}) {
  const visibles = columnas.filter((columna) => columna.prioridad === 1);
  return (
    <ul aria-label={titulo} aria-busy={actualizando} className="flex flex-col gap-3">
      {filas.map((fila) => (
        <li key={claveFila(fila)} className="bg-card rounded-lg border p-4">
          <dl className="flex flex-col gap-2">
            {visibles.map((columna) => (
              <div key={columna.id} className="flex items-baseline justify-between gap-4">
                <dt className="texto-nota text-muted-foreground">{columna.etiqueta}</dt>
                <dd className="texto-pequeno-fuerte text-right">{columna.celda(fila)}</dd>
              </div>
            ))}
          </dl>
        </li>
      ))}
    </ul>
  );
}

/**
 * FE-06: tabla de datos del servidor. El estado (página, tamaño, orden, dirección y filtros) vive en la URL;
 * desde `md` es una tabla y por debajo, tarjetas con las columnas de prioridad 1.
 */
export function TablaServidor<T, C extends ConsultaTabla>({
  titulo,
  columnas,
  consulta,
  parametros,
  claveFila,
  vacio,
  filtros,
}: PropsTablaServidor<T, C>) {
  const pantallaAncha = usePantallaAncha();
  const { valores, hayFiltros, limpiarFiltros } = parametros;
  // C extiende ConsultaTabla: estos campos existen en C con estos tipos.
  const cambiarVista: CambiarVista = (cambios, historial) => {
    parametros.cambiar(cambios as Partial<C>, { historial });
  };
  const paginacion = consulta.isPlaceholderData ? undefined : consulta.data?.paginacion;
  const ultimaPagina = paginacion ? Math.max(paginacion.totalPaginas, 1) : undefined;

  useEffect(() => {
    // Una página fuera de rango salta a la última que existe; con total 0, a la 1 (nunca a la 0).
    if (ultimaPagina !== undefined && valores.pagina > ultimaPagina) {
      parametros.cambiar({ pagina: ultimaPagina } as Partial<C>, { historial: 'reemplazar' });
    }
  }, [ultimaPagina, valores.pagina, parametros]);

  const vacioDeLaVista: ContenidoVacio = hayFiltros
    ? {
        titulo: 'Ningún resultado con estos filtros',
        descripcion: 'Prueba con otros filtros o límpialos para ver todo.',
        accion: (
          <Button variant="outline" size="sm" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
        ),
      }
    : vacio;

  return (
    <section className="flex flex-col gap-6">
      {filtros}
      <EstadoVista consulta={consulta} vacio={vacioDeLaVista} esqueleto={ESQUELETO}>
        {(respuesta) => {
          const actualizando = consulta.isPlaceholderData;
          const vista = { titulo, columnas, filas: respuesta.datos, claveFila, actualizando };
          return (
            <>
              <div aria-live="polite" className="texto-nota text-muted-foreground min-h-4">
                {actualizando && (
                  <span className="inline-flex items-center gap-1.5">
                    <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
                    Actualizando…
                  </span>
                )}
              </div>
              {pantallaAncha ? (
                <Tabla
                  {...vista}
                  orden={valores.orden}
                  direccion={valores.direccion}
                  cambiarVista={cambiarVista}
                />
              ) : (
                <Tarjetas {...vista} />
              )}
              <Paginacion
                paginacion={respuesta.paginacion}
                onPagina={(pagina) => {
                  cambiarVista({ pagina });
                }}
              />
            </>
          );
        }}
      </EstadoVista>
    </section>
  );
}
