import { idEnRutaSchema } from '@shopcart/shared';
import { SearchX } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import type { ErrorApi } from '../../../shared/api';
import { Aviso } from '../../../shared/componentes/Aviso';
import { AvisoDePagina } from '../../../shared/componentes/AvisoDePagina';
import { DialogoConfirmacion } from '../../../shared/componentes/DialogoConfirmacion';
import { AvisoConsultaFallida, EstadoVista } from '../../../shared/componentes/EstadoVista';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import type { ProductoAdmin } from '../catalogo.api';
import { DatosProducto, ID_FORMULARIO_PRODUCTO } from '../componentes/DatosProducto';
import { ImagenesProducto } from '../componentes/ImagenesProducto';
import { VariantesProducto } from '../componentes/VariantesProducto';
import { useAtributos } from '../hooks/useAtributos';
import { useCategoriasAdmin } from '../hooks/useCategoriasAdmin';
import { useCambiarProducto, useProductoAdmin } from '../hooks/useProductoAdmin';

const STATUS_NO_ENCONTRADO = 404;
const RUTA_LISTA = '/backoffice/catalogo';
const NUNCA_VACIO = () => false;
const SIN_USO = { titulo: '' };

function ProductoNoEncontrado() {
  return (
    <AvisoDePagina
      icono={SearchX}
      titulo="No encontramos este producto"
      acciones={
        <Button asChild>
          <Link to={RUTA_LISTA}>Ver los productos</Link>
        </Button>
      }
    >
      Puede que el enlace esté mal escrito o que el producto se haya eliminado.
    </AvisoDePagina>
  );
}

/**
 * N-14: un producto con historial no se elimina; el aviso ofrece desactivarlo, que es lo que el backend sí
 * permite.
 */
function AvisoDelEstado({
  error,
  activo,
  alDesactivar,
}: {
  error: ErrorApi;
  activo: boolean;
  alDesactivar: () => void;
}) {
  const ofrecerDesactivar = error.codigo === 'PRODUCTO_CON_HISTORIAL' && activo;
  return (
    <Aviso
      tipo="error"
      acciones={
        ofrecerDesactivar && (
          <Button variant="outline" size="sm" onClick={alDesactivar}>
            Desactivar producto
          </Button>
        )
      }
    >
      {error.mensaje}
    </Aviso>
  );
}

function Editor({ producto }: { producto: ProductoAdmin }) {
  const navigate = useNavigate();
  const categorias = useCategoriasAdmin();
  const atributos = useAtributos();
  const cambiar = useCambiarProducto(producto.idProducto);
  useTituloPagina(producto.nombre);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Ruta" className="texto-pequeno text-muted-foreground">
        <Link to={RUTA_LISTA} className="hover:underline">
          Productos y precios
        </Link>
        {` / ${producto.nombre}`}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="display-titulo-1">{producto.nombre}</h1>
          {!producto.activo && (
            <span className="texto-pequeno text-muted-foreground">Inactivo</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <DialogoConfirmacion
            titulo={`¿Eliminar ${producto.nombre}?`}
            descripcion="Se borran el producto, sus imágenes y sus variantes, y no se puede deshacer. Si no se puede eliminar, verás el motivo."
            textoConfirmar="Eliminar producto"
            disparador={
              <Button variant="ghost" disabled={cambiar.isPending}>
                Eliminar producto
              </Button>
            }
            alConfirmar={() => {
              cambiar.mutate('eliminar', { onSuccess: () => void navigate(RUTA_LISTA) });
            }}
          />
          <Button
            variant="outline"
            disabled={cambiar.isPending}
            onClick={() => {
              cambiar.mutate(producto.activo ? 'desactivar' : 'activar');
            }}
          >
            {producto.activo ? 'Desactivar producto' : 'Activar producto'}
          </Button>
          <Button type="submit" form={ID_FORMULARIO_PRODUCTO}>
            Guardar cambios
          </Button>
        </div>
      </div>
      {cambiar.error && (
        <AvisoDelEstado
          error={cambiar.error}
          activo={producto.activo}
          alDesactivar={() => {
            cambiar.mutate('desactivar');
          }}
        />
      )}
      <AvisoConsultaFallida consulta={categorias} titulo="No pudimos cargar las categorías." />
      <AvisoConsultaFallida consulta={atributos} titulo="No pudimos cargar los atributos." />
      <div className="grid items-start gap-6 md:grid-cols-[1fr_20rem]">
        <DatosProducto producto={producto} categorias={categorias.data ?? []} />
        <ImagenesProducto producto={producto} />
      </div>
      <VariantesProducto producto={producto} atributos={atributos.data ?? []} />
    </div>
  );
}

function DetalleProductoAdmin({ idProducto }: { idProducto: number }) {
  const consulta = useProductoAdmin(idProducto);
  if (consulta.isLoadingError && consulta.error.status === STATUS_NO_ENCONTRADO) {
    return <ProductoNoEncontrado />;
  }
  return (
    <EstadoVista consulta={consulta} vacio={SIN_USO} esVacio={NUNCA_VACIO}>
      {(producto) => <Editor producto={producto} />}
    </EstadoVista>
  );
}

/** M6-H04 (Figma 48:1309): `/backoffice/catalogo/productos/:id`, el editor de un producto, solo Admin. */
export function ProductoAdminPagina() {
  const id = idEnRutaSchema.safeParse(useParams().id);
  return id.success ? <DetalleProductoAdmin idProducto={id.data} /> : <ProductoNoEncontrado />;
}
