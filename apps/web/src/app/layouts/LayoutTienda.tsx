import { Outlet } from 'react-router';
import { EncabezadoTienda } from './EncabezadoTienda';

export function LayoutTienda() {
  return (
    <div className="flex min-h-dvh flex-col">
      <EncabezadoTienda />
      <main className="flex w-full flex-1 flex-col gap-6 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
