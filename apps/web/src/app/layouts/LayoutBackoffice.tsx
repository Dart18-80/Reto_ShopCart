import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { useAnimarEntrada } from '../../shared/hooks/useMovimiento';
import { Button } from '../../shared/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '../../shared/ui/sheet';
import { BarraLateralBackoffice, NOMBRE_MENU_BACKOFFICE } from './BarraLateralBackoffice';

/**
 * Figma: Backoffice · Pedidos (26:519). Barra lateral desde `md`; en pantallas angostas, la misma barra en un
 * Sheet que se abre con el botón de menú.
 */
export function LayoutBackoffice() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  // D2: cada cambio de página entra con un fundido; la clave es el pathname, no la búsqueda.
  const entrada = useAnimarEntrada<HTMLElement>(useLocation().pathname);

  return (
    <div className="flex min-h-dvh">
      <aside className="bg-card sticky top-0 hidden h-dvh w-62 shrink-0 border-r px-4 py-6 md:block">
        <BarraLateralBackoffice />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card flex items-center gap-4 border-b px-4 py-3 md:hidden">
          <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir el menú">
                <Menu aria-hidden className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-62 px-4 py-6">
              <SheetTitle className="sr-only">{NOMBRE_MENU_BACKOFFICE}</SheetTitle>
              <SheetDescription className="sr-only">Secciones del backoffice</SheetDescription>
              <BarraLateralBackoffice
                onNavegar={() => {
                  setMenuAbierto(false);
                }}
              />
            </SheetContent>
          </Sheet>
          <Link to="/" className="titulo-2 text-primary">
            ShopCart
          </Link>
        </header>
        <main ref={entrada} className="flex flex-1 flex-col gap-6 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
