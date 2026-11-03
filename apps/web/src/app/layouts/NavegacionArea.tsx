import { useId } from 'react';
import { NavLink } from 'react-router';
import { cn } from '../../shared/ui/cn';
import type { GrupoMenu, PaginaDeMenu } from '../rutas';

interface PropsNavegacionArea {
  nombre: string;
  entradas: readonly PaginaDeMenu[];
  /** Al elegir una entrada (el menú móvil se cierra). */
  onNavegar?: () => void;
}

interface Grupo {
  titulo: GrupoMenu | undefined;
  entradas: PaginaDeMenu[];
}

/** Agrupa las entradas en el orden de la definición; las que no tienen grupo forman uno sin título. */
function agrupar(entradas: readonly PaginaDeMenu[]): Grupo[] {
  const grupos: Grupo[] = [];
  for (const entrada of entradas) {
    const titulo = entrada.menu.grupo;
    const grupo = grupos.find((g) => g.titulo === titulo);
    if (grupo) grupo.entradas.push(entrada);
    else grupos.push({ titulo, entradas: [entrada] });
  }
  return grupos;
}

function ListaDelGrupo({ titulo, entradas, onNavegar }: Grupo & { onNavegar?: () => void }) {
  const idTitulo = useId();
  return (
    <div className="flex flex-col gap-0.5">
      {titulo && (
        <p id={idTitulo} className="texto-nota text-muted-foreground">
          {titulo}
        </p>
      )}
      <ul aria-labelledby={titulo ? idTitulo : undefined} className="flex flex-col gap-0.5">
        {entradas.map(({ ruta, menu: { etiqueta } }) => (
          <li key={ruta}>
            <NavLink
              to={ruta}
              onClick={onNavegar}
              className={({ isActive }) =>
                cn(
                  'texto-pequeno-fuerte flex items-center rounded-md px-3 py-2',
                  isActive
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              {etiqueta}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * El menú de un área (Figma: Elemento de menú), generado de la definición de rutas (FE-04): solo lo que el rol
 * puede abrir, y un grupo sin entradas visibles no aparece.
 */
export function NavegacionArea({ nombre, entradas, onNavegar }: PropsNavegacionArea) {
  return (
    <nav aria-label={nombre} className="flex flex-col gap-6">
      {agrupar(entradas).map((grupo) => (
        <ListaDelGrupo key={grupo.titulo ?? 'sin-grupo'} {...grupo} onNavegar={onNavegar} />
      ))}
    </nav>
  );
}
