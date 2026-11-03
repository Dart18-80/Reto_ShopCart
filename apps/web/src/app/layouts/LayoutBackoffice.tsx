import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet } from 'react-router';
import { useSesion } from '../../shared/hooks/useSesion';
import { Button } from '../../shared/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '../../shared/ui/sheet';
import { menuDe } from '../rutas';
import { SelectorTema } from '../tema/SelectorTema';
import { AccesoCuenta } from './AccesoCuenta';
import { NavegacionArea } from './NavegacionArea';

const NOMBRE_MENU = 'Backoffice';

/** Navegación lateral desde `md`; en el teléfono, el mismo menú en un panel que se abre con un botón. */
export function LayoutBackoffice() {
  const { estado } = useSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const entradas = menuDe('backoffice', estado);

  return (
    <div className="flex min-h-dvh">
      <aside className="bg-card hidden w-60 shrink-0 flex-col gap-6 border-r p-4 md:flex">
        <Link to="/" className="display-titulo-3 text-primary font-titulo px-3">
          ShopCart
        </Link>
        <NavegacionArea nombre={NOMBRE_MENU} entradas={entradas} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card flex items-center gap-2 border-b px-4 py-3">
          <Sheet open={menuAbierto} onOpenChange={setMenuAbierto}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir el menú" className="md:hidden">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-4">
              <SheetTitle>{NOMBRE_MENU}</SheetTitle>
              <SheetDescription className="sr-only">Secciones del backoffice</SheetDescription>
              <NavegacionArea
                nombre={NOMBRE_MENU}
                entradas={entradas}
                onNavegar={() => {
                  setMenuAbierto(false);
                }}
              />
            </SheetContent>
          </Sheet>
          <span className="control-etiqueta text-muted-foreground">Backoffice</span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">Ir a la tienda</Link>
            </Button>
            <SelectorTema />
            <AccesoCuenta />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
