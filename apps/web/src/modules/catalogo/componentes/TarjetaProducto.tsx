import { Link } from 'react-router';
import { Monto } from '../../../shared/componentes/Monto';
import { MuestraColor } from '../../../shared/componentes/prenda/MuestraColor';
import { Prenda } from '../../../shared/componentes/prenda/Prenda';
import type { ProductoBusqueda } from '../catalogo.api';
import { EtiquetaExistencia } from './EtiquetaExistencia';

/**
 * Figma: Tarjeta de producto (23:511; Normal en escritorio, Compacta en la cuadrícula móvil). La prenda de la
 * categoría toma el primer color (FE-16); las muestras son solo visuales. «Desde» + el precio mínimo tal como lo
 * manda el backend (FE-10), y la existencia solo como Disponible o Agotado (N-06).
 */
export function TarjetaProducto({ producto }: { producto: ProductoBusqueda }) {
  const [primerColor] = producto.colores;
  return (
    <Link
      to={`/productos/${String(producto.idProducto)}`}
      className="bg-card hover:border-primary focus-visible:ring-ring flex w-full flex-col overflow-hidden rounded-lg border transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="bg-muted flex aspect-square items-center justify-center">
        <Prenda tipo={producto.ilustracion} color={primerColor} className="h-2/3 w-2/3" />
      </div>
      <div className="flex flex-col gap-2 p-3 md:p-4">
        {producto.colores.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {producto.colores.map((color, indice) => (
              <MuestraColor key={color} color={color} seleccionada={indice === 0} />
            ))}
            <span className="sr-only">{`Colores: ${producto.colores.join(', ')}`}</span>
          </div>
        )}
        <h2 className="texto-base-fuerte">{producto.nombre}</h2>
        <p className="texto-nota text-muted-foreground hidden md:block">{producto.categoria}</p>
        <EtiquetaExistencia estado={producto.disponible ? 'Disponible' : 'Agotado'} />
        <p className="flex flex-col">
          <span className="texto-nota text-muted-foreground">Desde</span>
          <Monto valor={producto.precioMinimo} className="display-precio" />
        </p>
      </div>
    </Link>
  );
}
