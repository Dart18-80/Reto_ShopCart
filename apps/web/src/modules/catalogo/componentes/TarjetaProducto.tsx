import { Link } from 'react-router';
import { Monto } from '../../../shared/componentes/Monto';
import { clasesDelColor } from '../../../shared/componentes/prenda/colores';
import { MuestraColor } from '../../../shared/componentes/prenda/MuestraColor';
import { Prenda } from '../../../shared/componentes/prenda/Prenda';
import { cn } from '../../../shared/ui/cn';
import type { ProductoBusqueda } from '../catalogo.api';
import { EtiquetaExistencia } from './EtiquetaExistencia';
import { conId, RUTAS } from '../../../shared/rutas';

/**
 * Figma: Tarjeta de producto (23:511; Normal en escritorio, Compacta en la cuadrícula móvil). La prenda de la
 * categoría toma el primer color (FE-16); las muestras son solo visuales. «Desde» + el precio mínimo tal como lo
 * manda el backend (FE-10), y la existencia solo como Disponible o Agotado (N-06).
 */
export function TarjetaProducto({ producto }: { producto: ProductoBusqueda }) {
  const [primerColor] = producto.colores;
  return (
    <Link
      to={conId(RUTAS.producto, producto.idProducto)}
      className="group bg-card hover:border-primary focus-visible:ring-ring ease-salida flex w-full flex-col overflow-hidden rounded-tarjeta border shadow-sm transition-[translate,box-shadow,border-color] duration-(--dur-base) hover:shadow-md focus-visible:ring-2 focus-visible:outline-none motion-safe:hover:-translate-y-1"
    >
      {/* D5: la ilustración ocupa cerca del 70 % sobre un fondo teñido con el primer color del producto. */}
      <div
        className={cn(
          'fondo-tenido flex aspect-square items-center justify-center',
          clasesDelColor(primerColor).texto,
        )}
      >
        <Prenda
          tipo={producto.ilustracion}
          color={primerColor}
          className="ease-salida size-[70%] transition-[scale] duration-(--dur-base) motion-safe:group-hover:scale-[1.04]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4 md:p-5">
        {producto.colores.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {producto.colores.map((color, indice) => (
              <MuestraColor
                key={color}
                color={color}
                seleccionada={indice === 0}
                className="size-5"
              />
            ))}
            <span className="sr-only">{`Colores: ${producto.colores.join(', ')}`}</span>
          </div>
        )}
        <h2 className="texto-base-fuerte">{producto.nombre}</h2>
        <p className="texto-nota text-muted-foreground hidden md:block">{producto.categoria}</p>
        <EtiquetaExistencia estado={producto.disponible ? 'Disponible' : 'Agotado'} />
        <p className="mt-auto flex flex-col pt-2">
          <span className="texto-nota text-muted-foreground">Desde</span>
          <Monto valor={producto.precioMinimo} className="display-precio" />
        </p>
      </div>
    </Link>
  );
}
