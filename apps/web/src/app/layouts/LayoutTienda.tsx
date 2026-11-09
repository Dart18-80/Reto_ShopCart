import { Outlet, useLocation } from 'react-router';
import { useAnimarEntrada } from '../../shared/hooks/useMovimiento';
import { EncabezadoTienda } from './EncabezadoTienda';

export function LayoutTienda() {
  // D2: cada cambio de página entra con un fundido; la clave es el pathname, no la búsqueda.
  const entrada = useAnimarEntrada<HTMLElement>(useLocation().pathname);
  return (
    <div className="flex min-h-dvh flex-col">
      <EncabezadoTienda />
      <main
        ref={entrada}
        className="relative max-w-contenido mx-auto flex w-full flex-1 flex-col gap-6 p-4 md:p-8"
      >
        <Outlet />
      </main>
    </div>
  );
}
