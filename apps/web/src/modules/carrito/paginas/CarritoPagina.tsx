import { Link } from 'react-router';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { formatearConteo } from '../../../shared/formato/conteo';
import { useTituloPagina } from '../../../shared/hooks/useTituloPagina';
import { Button } from '../../../shared/ui/button';
import type { Carrito } from '../carrito.api';
import { ContinuarAlPago } from '../componentes/ContinuarAlPago';
import { CuponCarrito } from '../componentes/CuponCarrito';
import { ESQUELETO_CARRITO } from '../componentes/EsqueletoCarrito';
import { FilaCarrito } from '../componentes/FilaCarrito';
import { ResumenCarrito } from '../componentes/ResumenCarrito';
import { useCarrito } from '../hooks/useCarrito';

const sinLineas = (carrito: Carrito) => carrito.lineas.length === 0;

const VACIO = {
  titulo: 'Tu carrito está vacío',
  descripcion: 'Agrega productos desde el catálogo.',
  accion: (
    <Button asChild variant="outline" size="sm">
      <Link to="/">Ver el catálogo</Link>
    </Button>
  ),
};

/** Figma 38:627 y 38:807 (M3-H02): el carrito del invitado o del Cliente, tal como lo calcula el backend. */
export function CarritoPagina() {
  useTituloPagina('Tu carrito');
  const carrito = useCarrito();
  const resumen = carrito.data?.resumen;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="titulo-1">Tu carrito</h1>
        {resumen && resumen.lineas > 0 && (
          <p className="texto-pequeno text-muted-foreground hidden md:block">
            {`${formatearConteo(resumen.lineas, 'producto', 'productos')}, ${formatearConteo(resumen.unidades, 'unidad', 'unidades')}`}
          </p>
        )}
      </header>
      <EstadoVista
        consulta={carrito}
        vacio={VACIO}
        esVacio={sinLineas}
        esqueleto={ESQUELETO_CARRITO}
      >
        {({ lineas, resumen: delCarrito }) => (
          <div className="flex flex-col gap-6 pb-36 md:flex-row md:items-start md:gap-12 md:pb-0">
            <ul aria-label="Productos del carrito" className="min-w-0 flex-1">
              {lineas.map((linea) => (
                <FilaCarrito key={linea.idLinea} linea={linea} />
              ))}
            </ul>
            <div className="md:w-100 md:shrink-0">
              <ResumenCarrito
                resumen={delCarrito}
                antes={<CuponCarrito resumen={delCarrito} />}
                despues={<ContinuarAlPago resumen={delCarrito} />}
              />
            </div>
          </div>
        )}
      </EstadoVista>
    </div>
  );
}
