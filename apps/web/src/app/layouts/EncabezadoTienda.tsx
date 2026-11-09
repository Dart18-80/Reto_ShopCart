import { LayoutGrid, Menu, ShoppingBag, User } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ContadorCarrito } from '../../modules/carrito';
import { useDesplazado } from '../../shared/hooks/useDesplazado';
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
import { ACCESO_DE_AREA, menuDe, puedeAbrir, RAIZ_DE_AREA, type PaginaDeMenu } from '../rutas';
import { SelectorTema } from '../tema/SelectorTema';
import { Buscador } from './Buscador';
import { NavegacionArea } from './NavegacionArea';
import { RUTAS } from '../../shared/rutas';

const NOMBRE_MENU = 'Tienda';
// D4: cada acción del encabezado es un área táctil de 44 px.
const ACCION =
  'texto-pequeno-fuerte text-foreground hover:text-primary flex min-h-11 min-w-11 items-center justify-center gap-2';

function MenuEscritorio({ entradas }: { entradas: readonly PaginaDeMenu[] }) {
  return (
    <nav aria-label={NOMBRE_MENU} className="hidden md:block">
      <ul className="flex gap-6">
        {entradas.map(({ ruta, menu: { etiqueta } }) => (
          <li key={ruta}>
            {/* D4: la opción activa lleva un subrayado rojo de 2 px al borde del encabezado. */}
            <NavLink
              to={ruta}
              end
              className="texto-base-fuerte text-foreground hover:text-primary aria-[current=page]:border-b-marca-rojo flex h-16 items-center border-y-2 border-transparent"
            >
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
        <SheetTitle className="titulo-2 text-primary">ShopCart</SheetTitle>
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
  const desplazado = useDesplazado();

  // D4: fijo arriba, translúcido con desenfoque y con sombra solo después de desplazarse. Su alto (64 px; en móvil,
  // 56 px más el buscador) es --alto-encabezado de tema.css.
  return (
    <header
      data-desplazado={desplazado}
      className="bg-card supports-[backdrop-filter]:bg-card/80 sticky top-0 z-40 border-b backdrop-blur-md transition-shadow duration-(--dur-base) data-[desplazado=true]:shadow-xs"
    >
      <div className="max-w-contenido mx-auto flex flex-wrap items-center gap-x-3 px-4 md:h-16 md:flex-nowrap md:gap-8 md:px-8">
        <MenuMovil entradas={entradas} />
        <Link
          to={RAIZ_DE_AREA.tienda}
          className="titulo-2 text-primary flex h-14 flex-1 items-center md:h-auto md:flex-none"
        >
          ShopCart
        </Link>
        <MenuEscritorio entradas={entradas} />
        <Buscador className="order-last mb-3 w-full md:order-none md:mb-0 md:w-auto md:flex-1" />
        <div className="flex items-center gap-1 md:gap-3">
          {veBackoffice && (
            <Link to={RAIZ_DE_AREA.backoffice} aria-label="Backoffice" className={ACCION}>
              <LayoutGrid aria-hidden className="size-5" />
              <span className="hidden md:inline">Backoffice</span>
            </Link>
          )}
          <EnlaceCuenta />
          {puedeAbrir(RUTAS.carrito, estado) && (
            <Link to={RUTAS.carrito} aria-label="Carrito" className={ACCION}>
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
