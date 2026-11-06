import { consultaProductosAdminSchema, type OrdenProductosAdmin } from '@shopcart/shared';
import { Link } from 'react-router';
import { TablaServidor, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import type { ProductoResumenAdmin } from '../catalogo.api';
import { DialogoNuevoProducto } from '../componentes/DialogoNuevoProducto';
import { FiltrosProductosAdmin } from '../componentes/FiltrosProductosAdmin';
import { useCategoriasAdmin } from '../hooks/useCategoriasAdmin';
import { useProductosAdmin } from '../hooks/useProductosAdmin';

const columnas: ColumnaTabla<ProductoResumenAdmin, OrdenProductosAdmin['orden']>[] = [
  {
    id: 'nombre',
    etiqueta: 'Producto',
    prioridad: 1,
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
    celda: (p) => (
      <Link
        to={`/backoffice/catalogo/productos/${String(p.idProducto)}`}
        aria-label={`Editar ${p.nombre}`}
        className="texto-pequeno-fuerte text-primary hover:underline"
      >
        Editar
      </Link>
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="display-titulo-1">Productos y precios</h1>
          <p className="texto-base text-muted-foreground">
            Catálogo de la tienda, sus variantes y precios.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/backoffice/catalogo/categorias">Categorías y atributos</Link>
          </Button>
          <DialogoNuevoProducto categorias={lista} />
        </div>
      </div>
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
