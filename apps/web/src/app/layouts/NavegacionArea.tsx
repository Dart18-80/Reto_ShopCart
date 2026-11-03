import { NavLink } from 'react-router';
import { cn } from '../../shared/ui/cn';
import type { PaginaDeMenu } from '../rutas';

interface PropsNavegacionArea {
  nombre: string;
  entradas: readonly PaginaDeMenu[];
  /** Al elegir una entrada (el menú móvil se cierra). */
  onNavegar?: () => void;
}

/** El menú de un área, generado de la definición de rutas (FE-04): solo lo que el rol puede abrir. */
export function NavegacionArea({ nombre, entradas, onNavegar }: PropsNavegacionArea) {
  return (
    <nav aria-label={nombre}>
      <ul className="flex flex-col gap-1">
        {entradas.map(({ ruta, menu: { etiqueta, icono: Icono } }) => (
          <li key={ruta}>
            <NavLink
              to={ruta}
              onClick={onNavegar}
              className={({ isActive }) =>
                cn(
                  'control-etiqueta text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-3 rounded-md px-3 py-2',
                  isActive && 'bg-secondary text-secondary-foreground',
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
  );
}
