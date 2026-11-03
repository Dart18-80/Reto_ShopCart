import { Outlet } from 'react-router';
import { useSesion } from '../../shared/hooks/useSesion';
import { menuDe } from '../rutas';
import { BotonCerrarSesion } from './BotonCerrarSesion';
import { EncabezadoTienda } from './EncabezadoTienda';
import { NavegacionArea } from './NavegacionArea';

/** La cuenta comparte el encabezado de la tienda y agrega su menú (sin frame en Figma todavía). */
export function LayoutCuenta() {
  const { estado } = useSesion();

  return (
    <div className="flex min-h-dvh flex-col">
      <EncabezadoTienda />
      <div className="flex w-full flex-1 flex-col gap-6 p-4 md:flex-row md:gap-8 md:p-8">
        <aside className="flex flex-col gap-4 md:w-56 md:shrink-0">
          <NavegacionArea nombre="Mi cuenta" entradas={menuDe('cuenta', estado)} />
          <div>
            <BotonCerrarSesion variante="texto" />
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col gap-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
