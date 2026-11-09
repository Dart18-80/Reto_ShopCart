import type { ReactNode } from 'react';

/**
 * D6: el encabezado de cada página del backoffice: título, descripción y, a la derecha, sus acciones. Lo que
 * acompaña a la descripción (el indicador del tiempo real) va como `children`.
 */
export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
  children,
}: {
  titulo: string;
  descripcion?: ReactNode;
  acciones?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="titulo-1">{titulo}</h1>
        {descripcion && <p className="texto-base text-muted-foreground max-w-2xl">{descripcion}</p>}
        {children}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </header>
  );
}
