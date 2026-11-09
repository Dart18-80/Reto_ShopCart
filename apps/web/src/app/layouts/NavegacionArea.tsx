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
        // D6: las etiquetas de sección en mayúsculas, 11 px y con espaciado.
        <p
          id={idTitulo}
          className="text-muted-foreground px-3 pb-1 text-[0.6875rem] leading-4 font-semibold tracking-[0.08em] uppercase"
        >
          {titulo}
        </p>
      )}
      <ul aria-labelledby={titulo ? idTitulo : undefined} className="flex flex-col gap-0.5">
        {entradas.map(({ ruta, menu: { etiqueta, icono: Icono } }) => (
          <li key={ruta}>
            <NavLink
              to={ruta}
              onClick={onNavegar}
              className={({ isActive }) =>
                cn(
                  // D6: la opción activa con fondo azul marino al 8 % y una barra de 3 px a la izquierda.
                  'texto-pequeno-fuerte relative flex min-h-10 items-center gap-3 rounded-control px-3 py-2 transition-colors',
                  isActive
                    ? 'bg-primary/8 text-primary before:bg-primary before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <Icono aria-hidden className="size-4.5 shrink-0" />
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
