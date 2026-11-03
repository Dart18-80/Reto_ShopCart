import { Outlet } from 'react-router';
import { useSesion } from '../../shared/hooks/useSesion';
import { menuDe } from '../rutas';
import { EncabezadoTienda } from './EncabezadoTienda';
import { NavegacionArea } from './NavegacionArea';

/** La cuenta comparte el encabezado de la tienda y agrega su menú (perfil, direcciones del Cliente). */
export function LayoutCuenta() {
  const { estado } = useSesion();

  return (
    <div className="flex min-h-dvh flex-col">
      <EncabezadoTienda />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        <aside className="md:w-56 md:shrink-0">
          <NavegacionArea nombre="Mi cuenta" entradas={menuDe('cuenta', estado)} />
        </aside>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
