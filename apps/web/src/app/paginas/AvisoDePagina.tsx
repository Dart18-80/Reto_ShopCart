import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTituloPagina } from '../../shared/hooks/useTituloPagina';

interface PropsAvisoDePagina {
  icono: LucideIcon;
  titulo: string;
  children: ReactNode;
  acciones: ReactNode;
}

/** El esqueleto común de Sin permiso, No encontrado y los errores: ícono, título, explicación y acciones. */
export function AvisoDePagina({ icono: Icono, titulo, children, acciones }: PropsAvisoDePagina) {
  useTituloPagina(titulo);
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <Icono aria-hidden className="text-muted-foreground size-10" />
      <h1 className="display-titulo-2">{titulo}</h1>
      <div className="text-muted-foreground texto-base">{children}</div>
      <div className="flex flex-wrap justify-center gap-3">{acciones}</div>
    </section>
  );
}
