import { Link, NavLink } from 'react-router';
import { useSesion } from '../../shared/hooks/useSesion';
import { cn } from '../../shared/ui/cn';
import { menuDe } from '../rutas';
import { SelectorTema } from '../tema/SelectorTema';
import { AccesoCuenta } from './AccesoCuenta';

/** Marca, menú de la tienda (catálogo, carrito, mis pedidos según el rol), tema y acceso a la cuenta. */
export function EncabezadoTienda() {
  const { estado } = useSesion();

  return (
    <header className="bg-card border-b">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link to="/" className="display-titulo-3 text-primary font-titulo">
          ShopCart
        </Link>
        <nav aria-label="Tienda" className="order-last w-full sm:order-none sm:w-auto">
          <ul className="flex gap-1">
            {menuDe('tienda', estado).map(({ ruta, menu: { etiqueta, icono: Icono } }) => (
              <li key={ruta}>
                <NavLink
                  to={ruta}
                  end
                  className={({ isActive }) =>
                    cn(
                      'control-etiqueta text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1',
                      isActive && 'text-primary',
                    )
                  }
                >
                  <Icono aria-hidden className="size-4" />
                  {etiqueta}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <SelectorTema />
          <AccesoCuenta />
        </div>
      </div>
    </header>
  );
}
