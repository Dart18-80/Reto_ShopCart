import { LayoutGrid, Menu, ShoppingBag, User } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ContadorCarrito } from '../../modules/carrito';
import { useSesion } from '../../shared/hooks/useSesion';
import { Button } from '../../shared/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '../../shared/ui/sheet';
import { permisoPara } from '../acceso';
import { rutaDeIngreso } from '../Guardian';
import {
  ACCESO_DE_AREA,
  menuDe,
  puedeAbrir,
  RAIZ_DE_AREA,
  RUTA_CARRITO,
  type PaginaDeMenu,
} from '../rutas';
import { SelectorTema } from '../tema/SelectorTema';
import { Buscador } from './Buscador';
import { NavegacionArea } from './NavegacionArea';

const NOMBRE_MENU = 'Tienda';
const ACCION = 'texto-pequeno-fuerte text-foreground flex items-center gap-2';

function MenuEscritorio({ entradas }: { entradas: readonly PaginaDeMenu[] }) {
  return (
    <nav aria-label={NOMBRE_MENU} className="hidden md:block">
      <ul className="flex gap-6">
        {entradas.map(({ ruta, menu: { etiqueta } }) => (
          <li key={ruta}>
            <NavLink to={ruta} end className="texto-base-fuerte text-foreground hover:text-primary">
              {etiqueta}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MenuMovil({ entradas }: { entradas: readonly PaginaDeMenu[] }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir el menú" className="md:hidden">
          <Menu aria-hidden className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-62 gap-6 px-4 py-6">
        <SheetTitle className="display-titulo-3 text-primary">ShopCart</SheetTitle>
        <SheetDescription className="sr-only">Secciones de la tienda</SheetDescription>
        <NavegacionArea
          nombre={NOMBRE_MENU}
          entradas={entradas}
          onNavegar={() => {
            setAbierto(false);
          }}
        />
        <div className="mt-auto flex items-center gap-2">
          <SelectorTema />
          <span className="texto-pequeno text-muted-foreground">Tema</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** «Ingresar» sin sesión (vuelve a esta ruta al entrar) y «Mi cuenta» con sesión; en móvil, solo el ícono. */
function EnlaceCuenta() {
  const { usuario } = useSesion();
  const { pathname, search } = useLocation();
  const etiqueta = usuario ? 'Mi cuenta' : 'Ingresar';
  return (
    <Link
      to={usuario ? RAIZ_DE_AREA.cuenta : rutaDeIngreso(`${pathname}${search}`)}
      aria-label={etiqueta}
      className={ACCION}
    >
      <User aria-hidden className="size-5" />
      <span className="hidden md:inline">{etiqueta}</span>
    </Link>
  );
}

/**
 * Figma: Encabezado tienda (20:211 escritorio, 20:236 móvil). La cantidad del carrito llega con el módulo
 * Carrito, de su consulta (FE-02).
 */
export function EncabezadoTienda() {
  const { estado } = useSesion();
  const entradas = menuDe('tienda', estado);
  const veBackoffice = permisoPara(ACCESO_DE_AREA.backoffice, estado) === 'permitido';

  return (
    <header className="bg-card border-b">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 md:flex-nowrap md:gap-8 md:px-8 md:py-4">
        <MenuMovil entradas={entradas} />
        <Link
          to={RAIZ_DE_AREA.tienda}
          className="display-titulo-3 text-primary flex-1 md:flex-none"
        >
          ShopCart
        </Link>
        <MenuEscritorio entradas={entradas} />
        <Buscador className="order-last w-full md:order-none md:w-auto md:flex-1" />
        <div className="flex items-center gap-4 md:gap-5">
          {veBackoffice && (
            <Link to={RAIZ_DE_AREA.backoffice} aria-label="Backoffice" className={ACCION}>
              <LayoutGrid aria-hidden className="size-5" />
              <span className="hidden md:inline">Backoffice</span>
            </Link>
          )}
          <EnlaceCuenta />
          {puedeAbrir(RUTA_CARRITO, estado) && (
            <Link to={RUTA_CARRITO} aria-label="Carrito" className={ACCION}>
              <ShoppingBag aria-hidden className="size-5" />
              <ContadorCarrito />
            </Link>
          )}
          <div className="hidden md:block">
            <SelectorTema />
          </div>
        </div>
      </div>
    </header>
  );
}
