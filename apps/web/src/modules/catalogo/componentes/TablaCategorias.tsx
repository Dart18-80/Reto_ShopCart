import { Aviso } from '../../../shared/componentes/Aviso';
import { DialogoConfirmacion } from '../../../shared/componentes/DialogoConfirmacion';
import { Prenda } from '../../../shared/componentes/prenda/Prenda';
import { TablaLocal, type ColumnaTabla } from '../../../shared/componentes/TablaServidor';
import { Button } from '../../../shared/ui/button';
import type { AccionCategoria, CategoriaAdmin } from '../catalogo.api';
import { useCambiarCategoria } from '../hooks/useCategoriasAdmin';
import { DialogoEditarCategoria } from './DialogoCategoria';

type Cambiar = (idCategoria: number, accion: AccionCategoria) => void;

function Acciones({
  categoria,
  cambiar,
  ocupada,
}: {
  categoria: CategoriaAdmin;
  cambiar: Cambiar;
  ocupada: boolean;
}) {
  const { idCategoria, nombre, activo } = categoria;
  const estado: AccionCategoria = activo ? 'desactivar' : 'activar';
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <DialogoEditarCategoria
        categoria={categoria}
        disparador={
          <Button variant="ghost" size="sm" aria-label={`Editar ${nombre}`}>
            Editar
          </Button>
        }
      />
      <Button
        variant="ghost"
        size="sm"
        disabled={ocupada}
        aria-label={`${activo ? 'Desactivar' : 'Activar'} ${nombre}`}
        onClick={() => {
          cambiar(idCategoria, estado);
        }}
      >
        {activo ? 'Desactivar' : 'Activar'}
      </Button>
      <DialogoConfirmacion
        titulo={`¿Eliminar ${nombre}?`}
        descripcion="Se borra la categoría, y no se puede deshacer. Si no se puede eliminar, verás el motivo."
        textoConfirmar="Eliminar categoría"
        disparador={
          <Button
            variant="ghost-destructive"
            size="sm"
            disabled={ocupada}
            aria-label={`Eliminar ${nombre}`}
          >
            Eliminar
          </Button>
        }
        alConfirmar={() => {
          cambiar(idCategoria, 'eliminar');
        }}
      />
    </div>
  );
}

const columnas = (cambiar: Cambiar, ocupada: boolean): ColumnaTabla<CategoriaAdmin, never>[] => [
  { id: 'nombre', etiqueta: 'Categoría', prioridad: 1, celda: (c) => c.nombre },
  {
    id: 'ilustracion',
    etiqueta: 'Ilustración',
    prioridad: 2,
    celda: (c) => <Prenda tipo={c.ilustracion} className="size-10" />,
  },
  {
    id: 'productos',
    etiqueta: 'Productos',
    prioridad: 1,
    alineacion: 'fin',
    celda: (c) => String(c.productos),
  },
  {
    id: 'estado',
    etiqueta: 'Estado',
    prioridad: 1,
    celda: (c) => (
      <span className={c.activo ? 'text-exito' : 'text-muted-foreground'}>
        {c.activo ? 'Activa' : 'Inactiva'}
      </span>
    ),
  },
  {
    id: 'acciones',
    etiqueta: 'Acciones',
    prioridad: 1,
    alineacion: 'fin',
    celda: (c) => <Acciones categoria={c} cambiar={cambiar} ocupada={ocupada} />,
  },
];

/**
 * M6-H02: todas las categorías, también las inactivas, para reactivarlas (N-14). Activar, desactivar y eliminar
 * esperan al backend; su rechazo (CATEGORIA_CON_PRODUCTOS, en uso) llega con su mensaje.
 */
export function TablaCategorias({ categorias }: { categorias: CategoriaAdmin[] }) {
  const cambio = useCambiarCategoria();
  const cambiar: Cambiar = (idCategoria, accion) => {
    cambio.mutate({ idCategoria, accion });
  };
  return (
    <div className="flex flex-col gap-3">
      {cambio.error && <Aviso tipo="error">{cambio.error.mensaje}</Aviso>}
      <TablaLocal
        titulo="Categorías"
        columnas={columnas(cambiar, cambio.isPending)}
        filas={categorias}
        claveFila={(c) => c.idCategoria}
      />
    </div>
  );
}
