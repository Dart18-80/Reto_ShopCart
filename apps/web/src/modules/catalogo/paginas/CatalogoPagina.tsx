import { consultaBusquedaSchema } from '@shopcart/shared';
import { Actualizando } from '../../../shared/componentes/Actualizando';
import { EstadoVista, type ContenidoVacio } from '../../../shared/componentes/EstadoVista';
import { Paginacion } from '../../../shared/componentes/Paginacion';
import { formatearConteo } from '../../../shared/formato/conteo';
import { usePaginaEnRango } from '../../../shared/hooks/usePaginaEnRango';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import { Skeleton } from '../../../shared/ui/skeleton';
import { ChipsCategoria } from '../componentes/ChipsCategoria';
import { CuadriculaProductos, ESQUELETO_CUADRICULA } from '../componentes/CuadriculaProductos';
import { FiltrosCatalogo } from '../componentes/FiltrosCatalogo';
import { FiltrosMovil } from '../componentes/FiltrosMovil';
import { SelectorOrden } from '../componentes/SelectorOrden';
import { useCategorias } from '../hooks/useCategorias';
import { useProductos } from '../hooks/useProductos';

// Las categorías nunca están «vacías»: sin ninguna, queda el chip Todo.
const NUNCA_VACIO = () => false;
const ESQUELETO_CHIPS = <Skeleton className="h-9 w-full max-w-xl rounded-full" />;
const productos = (total: number) => formatearConteo(total, 'producto', 'productos');

/** Figma 22:2 y 23:516 (M2-H02): la búsqueda de la tienda; todo su estado vive en la URL (FE-06). */
export function CatalogoPagina() {
  const parametros = useParametrosUrl(consultaBusquedaSchema);
  const { valores, cambiar, hayFiltros, limpiarFiltros } = parametros;
  const busqueda = useProductos(valores);
  const categorias = useCategorias();
  usePaginaEnRango(busqueda, parametros);

  const categoria = categorias.data?.find((c) => c.idCategoria === valores.categoria);
  const titulo = categoria?.nombre ?? 'Catálogo';
  useTituloPagina(titulo);
  const total = busqueda.isPlaceholderData ? undefined : busqueda.data?.paginacion.total;
  const filtros = { valores, onCambiar: cambiar, onLimpiar: limpiarFiltros };

  const vacio: ContenidoVacio = hayFiltros
    ? {
        titulo: 'Ningún producto con estos filtros',
        descripcion: 'Prueba con otros filtros o límpialos para ver todo el catálogo.',
        accion: (
          <Button variant="outline" size="sm" onClick={limpiarFiltros}>
            Limpiar filtros
          </Button>
        ),
      }
    : {
        titulo: 'Todavía no hay productos',
        descripcion: 'Vuelve pronto: estamos preparando el catálogo.',
      };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        {categoria && (
          <p className="texto-pequeno text-muted-foreground hidden md:block">{`Catálogo / ${categoria.nombre}`}</p>
        )}
        <div className="flex items-baseline gap-3">
          <h1 className="titulo-1">{titulo}</h1>
          {total !== undefined && (
            <p className="texto-pequeno text-muted-foreground hidden md:block">
              {productos(total)}
            </p>
          )}
        </div>
      </header>

      <EstadoVista
        consulta={categorias}
        vacio={{ titulo: 'Sin categorías' }}
        esVacio={NUNCA_VACIO}
        esqueleto={ESQUELETO_CHIPS}
      >
        {(lista) => (
          <ChipsCategoria
            categorias={lista}
            seleccionada={valores.categoria}
            onElegir={(idCategoria) => {
              cambiar({ categoria: idCategoria });
            }}
          />
        )}
      </EstadoVista>

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <aside
          aria-labelledby="titulo-filtros"
          className="hidden md:flex md:w-60 md:shrink-0 md:flex-col md:gap-5"
        >
          <h2 id="titulo-filtros" className="titulo-2">
            Filtros
          </h2>
          <FiltrosCatalogo {...filtros} />
        </aside>

        <section aria-label="Productos" className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center gap-2 md:justify-between">
            <FiltrosMovil {...filtros} />
            <p className="texto-pequeno text-muted-foreground hidden md:block">
              {total !== undefined &&
                busqueda.data &&
                total > 0 &&
                mostrando(busqueda.data.paginacion, busqueda.data.datos.length)}
            </p>
            <div className="min-w-0 flex-1 md:w-60 md:flex-none">
              <SelectorOrden
                valor={valores}
                onCambiar={(orden) => {
                  cambiar(orden);
                }}
              />
            </div>
          </div>
          {total !== undefined && (
            <p className="texto-pequeno text-muted-foreground md:hidden">{productos(total)}</p>
          )}

          <EstadoVista consulta={busqueda} vacio={vacio} esqueleto={ESQUELETO_CUADRICULA}>
            {(respuesta) => (
              <>
                <Actualizando activo={busqueda.isPlaceholderData} />
                <div aria-busy={busqueda.isPlaceholderData}>
                  <CuadriculaProductos productos={respuesta.datos} />
                </div>
                <Paginacion
                  paginacion={respuesta.paginacion}
                  onPagina={(pagina) => {
                    cambiar({ pagina });
                  }}
                />
              </>
            )}
          </EstadoVista>
        </section>
      </div>
    </div>
  );
}

/** «Mostrando 1 a 20 de 45 productos»: conteos de la paginación del backend, no montos. */
function mostrando(
  { pagina, tamano, total }: { pagina: number; tamano: number; total: number },
  enLaPagina: number,
) {
  const desde = (pagina - 1) * tamano + 1;
  return `Mostrando ${String(desde)} a ${String(desde + enLaPagina - 1)} de ${productos(total)}`;
}
