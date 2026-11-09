import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { useDesbordaAncho } from '../hooks/useDesbordaAncho';
import { usePaginaEnRango } from '../hooks/usePaginaEnRango';
import type { ModoHistorial, ParametrosUrl } from '../hooks/useParametrosUrl';
import { usePantallaAncha } from '../hooks/usePantallaAncha';
import { Button } from '../ui/button';
import { cn } from '../ui/cn';
import { Skeleton } from '../ui/skeleton';
import { Actualizando } from './Actualizando';
import { BarraProgreso } from './BarraProgreso';
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
  /**
   * D6: dónde va en la tarjeta de móvil: `titulo` arriba a la izquierda (el número de pedido) y `esquina` arriba a
   * la derecha (el estado), sin su etiqueta. Las demás columnas de prioridad 1 van debajo.
   */
  enTarjeta?: 'titulo' | 'esquina';
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
  <div className="bg-card flex flex-col gap-4 rounded-tarjeta border p-4">
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
    'texto-pequeno-fuerte text-muted-foreground bg-muted h-11 px-4',
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
        className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm outline-none focus-visible:ring-2"
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
  const contenedor = useRef<HTMLDivElement>(null);
  const tabla = useRef<HTMLTableElement>(null);
  const desborda = useDesbordaAncho(contenedor, tabla);
  return (
    // D6: sin scroll anidado. Si la tabla cabe a lo ancho, su encabezado se queda fijo arriba de la ventana desde
    // 1024 px (el backoffice no tiene encabezado de app desde md); si no cabe, se desplaza a lo ancho dentro de la
    // tarjeta, con encabezado normal, y esa área se puede enfocar para desplazarla con el teclado.
    <div
      ref={contenedor}
      tabIndex={desborda ? 0 : undefined}
      role={desborda ? 'group' : undefined}
      aria-label={desborda ? titulo : undefined}
      className={cn(
        'bg-card relative rounded-tarjeta border shadow-xs',
        desborda
          ? 'overflow-x-auto focus-visible:ring-2 focus-visible:ring-ring'
          : 'overflow-visible',
      )}
    >
      {actualizando && <BarraProgreso className="absolute inset-x-0 top-0" />}
      <table
        ref={tabla}
        aria-label={titulo}
        aria-busy={actualizando}
        className="w-full border-collapse text-left"
      >
        <thead
          className={cn(
            'bg-muted shadow-[0_1px_0_var(--border)] [&_th:first-child]:rounded-tl-tarjeta [&_th:last-child]:rounded-tr-tarjeta',
            !desborda && 'lg:sticky lg:top-0 lg:z-10',
          )}
        >
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
        <tbody
          className={cn('transition-opacity duration-(--dur-base)', actualizando && 'opacity-60')}
        >
          {filas.map((fila) => (
            // D6: filas de 52 px que se resaltan al pasar el cursor.
            <tr key={claveFila(fila)} className="hover:bg-muted/50 h-13 border-t transition-colors">
              {columnas.map((columna) => (
                <td
                  key={columna.id}
                  className={cn(
                    'texto-pequeno px-4 py-2',
                    columna.alineacion === 'fin' && 'text-right tabular-nums',
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
  const columnaTitulo = columnas.find((columna) => columna.enTarjeta === 'titulo');
  const esquina = columnas.find((columna) => columna.enTarjeta === 'esquina');
  const visibles = columnas.filter(
    (columna) => columna.prioridad === 1 && columna.enTarjeta === undefined,
  );
  return (
    <ul
      aria-label={titulo}
      aria-busy={actualizando}
      className={cn(
        'relative flex flex-col gap-3 transition-opacity duration-(--dur-base)',
        actualizando && 'opacity-60',
      )}
    >
      {actualizando && <BarraProgreso className="absolute inset-x-0 -top-2" />}
      {filas.map((fila) => (
        <li
          key={claveFila(fila)}
          className="bg-card rounded-tarjeta flex flex-col gap-2 border p-3.5 shadow-xs"
        >
          {(columnaTitulo ?? esquina) && (
            <div className="flex items-start justify-between gap-3">
              <span className="texto-base-fuerte min-w-0">{columnaTitulo?.celda(fila)}</span>
              {esquina?.celda(fila)}
            </div>
          )}
          <dl className="flex flex-col gap-1.5">
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
  usePaginaEnRango(consulta, parametros);

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
      {/* D6: los filtros en una tarjeta, con los controles a la misma altura (D1). */}
      {filtros && (
        <div className="bg-card rounded-tarjeta border p-4 shadow-xs md:p-5">{filtros}</div>
      )}
      <EstadoVista consulta={consulta} vacio={vacioDeLaVista} esqueleto={ESQUELETO}>
        {(respuesta) => {
          const actualizando = consulta.isPlaceholderData;
          const vista = { titulo, columnas, filas: respuesta.datos, claveFila, actualizando };
          return (
            <>
              <Actualizando activo={actualizando} />
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

const SIN_ORDEN: CambiarVista = () => undefined;

/**
 * Una lista corta que el servidor no pagina (las categorías, M6-H02): la misma tabla desde `md` y las mismas
 * tarjetas por debajo que TablaServidor, sin orden ni paginación.
 */
export function TablaLocal<T>({
  titulo,
  columnas,
  filas,
  claveFila,
}: {
  titulo: string;
  columnas: readonly ColumnaTabla<T, never>[];
  filas: T[];
  claveFila: (fila: T) => string | number;
}) {
  const pantallaAncha = usePantallaAncha();
  const vista = { titulo, columnas, filas, claveFila, actualizando: false };
  return pantallaAncha ? (
    <Tabla {...vista} orden={undefined} direccion={undefined} cambiarVista={SIN_ORDEN} />
  ) : (
    <Tarjetas {...vista} />
  );
}
