import type { ReactNode } from 'react';
import { PanelMarca } from './PanelMarca';

interface PropsTarjetaCuenta {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
  /** La línea de abajo: «¿No tienes cuenta? Crea una». */
  pie: ReactNode;
}

/**
 * Figma: Cuenta · Ingresar (26:414 y 26:460). D4: desde 1024 px, dos columnas (el panel de la marca y el
 * formulario) que llenan la ventana bajo el encabezado; por debajo, solo la tarjeta del formulario. El alto mínimo
 * descuenta el encabezado y el relleno de la página, así Ingresar no hace scroll.
 */
export function TarjetaCuenta({ titulo, subtitulo, children, pie }: PropsTarjetaCuenta) {
  return (
    <div className="lg:rounded-panel lg:bg-card mx-auto grid w-full max-w-5xl lg:min-h-[calc(100dvh-var(--alto-encabezado)-4rem)] lg:grid-cols-2 lg:overflow-hidden lg:border lg:shadow-sm">
      <PanelMarca className="hidden lg:flex" />
      <section className="bg-card rounded-panel mx-auto flex w-full max-w-[420px] flex-col justify-center gap-5 border px-4 py-6 md:my-8 md:p-8 lg:my-0 lg:max-w-none lg:rounded-none lg:border-0 lg:px-14">
        <div className="flex flex-col gap-1.5">
          <h1 className="titulo-1">{titulo}</h1>
          <p className="texto-base text-muted-foreground">{subtitulo}</p>
        </div>
        {children}
        <p className="texto-pequeno text-muted-foreground flex justify-center gap-1.5">{pie}</p>
      </section>
    </div>
  );
}
