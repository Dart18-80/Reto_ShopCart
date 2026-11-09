import { consultaProductosAdminSchema, type OrdenProductosAdmin } from '@shopcart/shared';
import { Link } from 'react-router';
import { AvisoConsultaFallida } from '../../../shared/componentes/EstadoVista';
import { TablaServidor, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import type { ProductoResumenAdmin } from '../catalogo.api';
import { DialogoNuevoProducto } from '../componentes/DialogoNuevoProducto';
import { FiltrosProductosAdmin } from '../componentes/FiltrosProductosAdmin';
import { useCategoriasAdmin } from '../hooks/useCategoriasAdmin';
import { useProductosAdmin } from '../hooks/useProductosAdmin';
import { conId, RUTAS } from '../../../shared/rutas';
import { EncabezadoPagina } from '../../../shared/componentes/EncabezadoPagina';

const columnas: ColumnaTabla<ProductoResumenAdmin, OrdenProductosAdmin['orden']>[] = [
  {
    id: 'nombre',
    etiqueta: 'Producto',
    prioridad: 1,
    enTarjeta: 'titulo',
    ordenable: 'nombre',
    celda: (p) => <span className="texto-pequeno-fuerte">{p.nombre}</span>,
  },
  {
    id: 'categoria',
    etiqueta: 'Categoría',
    prioridad: 2,
    ordenable: 'categoria',
    celda: (p) => p.categoria,
  },
  {
    id: 'variantes',
    etiqueta: 'Variantes',
    prioridad: 1,
    alineacion: 'fin',
    // Activas de todas, como las cuenta el backend.
    celda: (p) => `${String(p.variantesActivas)} de ${String(p.variantes)}`,
  },
  {
    id: 'estado',
    etiqueta: 'Estado',
    prioridad: 1,
    enTarjeta: 'esquina',
    celda: (p) => (
      <span className={p.activo ? 'text-exito' : 'text-muted-foreground'}>
        {p.activo ? 'Activo' : 'Inactivo'}
      </span>
    ),
  },
  {
    id: 'editar',
    etiqueta: 'Acciones',
    prioridad: 1,
    alineacion: 'fin',
    // D6: la acción de la fila, visible con su texto, como botón fantasma pequeño.
    celda: (p) => (
      <Button asChild variant="ghost" size="sm" className="text-primary">
        <Link to={conId(RUTAS.productoAdmin, p.idProducto)} aria-label={`Editar ${p.nombre}`}>
          Editar
        </Link>
      </Button>
    ),
  },
];

/**
 * M6-H03 (Figma 48:1169): `/backoffice/catalogo`, los productos de la tienda con filtros, orden y paginación del
 * servidor (FE-06, M6-H01), y el alta de uno nuevo.
 */
export function GestionCatalogoPagina() {
  useTituloPagina('Productos y precios');
  const parametros = useParametrosUrl(consultaProductosAdminSchema);
  const productos = useProductosAdmin(parametros.valores);
  const categorias = useCategoriasAdmin();
  const lista = categorias.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo="Productos y precios"
        descripcion="Catálogo de la tienda, sus variantes y precios."
        acciones={
          <>
            <Button asChild variant="outline">
              <Link to={RUTAS.categorias}>Categorías y atributos</Link>
            </Button>
            <DialogoNuevoProducto categorias={lista} />
          </>
        }
      />
      <AvisoConsultaFallida consulta={categorias} titulo="No pudimos cargar las categorías." />
      <TablaServidor
        titulo="Productos"
        columnas={columnas}
        consulta={productos}
        parametros={parametros}
        claveFila={(p) => p.idProducto}
        vacio={{ titulo: 'Todavía no hay productos', descripcion: 'Crea el primero.' }}
        filtros={<FiltrosProductosAdmin parametros={parametros} categorias={lista} />}
      />
    </div>
  );
}
