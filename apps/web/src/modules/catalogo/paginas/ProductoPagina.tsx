import { idEnRutaSchema } from '@shopcart/shared';
import { SearchX } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { z } from 'zod';
import { AvisoDePagina } from '../../../shared/componentes/AvisoDePagina';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { useParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import { FichaProducto } from '../componentes/FichaProducto';
import { useProducto } from '../hooks/useProducto';

const STATUS_NO_ENCONTRADO = 404;
const consultaDetalleSchema = z.object({ variante: idEnRutaSchema.optional() });
// El producto existe si la consulta respondió: nunca es «vacío».
const NUNCA_VACIO = () => false;

function ProductoNoEncontrado() {
  return (
    <AvisoDePagina
      icono={SearchX}
      titulo="No encontramos este producto"
      acciones={
        <Button asChild>
          <Link to="/">Ir al catálogo</Link>
        </Button>
      }
    >
      Puede que el enlace esté mal escrito o que el producto ya no esté a la venta.
    </AvisoDePagina>
  );
}

function DetalleProducto({ idProducto }: { idProducto: number }) {
  const consulta = useProducto(idProducto);
  const parametros = useParametrosUrl(consultaDetalleSchema);
  useTituloPagina(consulta.data?.nombre ?? 'Producto');

  // RF-01: inexistente e inactivo responden igual (404).
  if (consulta.isLoadingError && consulta.error.status === STATUS_NO_ENCONTRADO) {
    return <ProductoNoEncontrado />;
  }
  return (
    <EstadoVista consulta={consulta} vacio={{ titulo: 'Sin producto' }} esVacio={NUNCA_VACIO}>
      {(producto) => (
        <FichaProducto
          producto={producto}
          idVarianteEnUrl={parametros.valores.variante}
          alResolver={(variante) => {
            parametros.cambiar({ variante }, { historial: 'reemplazar' });
          }}
        />
      )}
    </EstadoVista>
  );
}

/** M2-H03: `/productos/:id`. Un id que no es un número es un producto que no existe. */
export function ProductoPagina() {
  const id = idEnRutaSchema.safeParse(useParams().id);
  return id.success ? <DetalleProducto idProducto={id.data} /> : <ProductoNoEncontrado />;
}
