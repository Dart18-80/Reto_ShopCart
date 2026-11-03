import { Outlet } from 'react-router';
import { EncabezadoTienda } from './EncabezadoTienda';

export function LayoutTienda() {
  return (
    <div className="flex min-h-dvh flex-col">
      <EncabezadoTienda />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
