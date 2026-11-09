import type { ReactNode } from 'react';

interface PropsTarjetaCuenta {
  titulo: string;
  subtitulo: string;
  children: ReactNode;
  /** La línea de abajo: «¿No tienes cuenta? Crea una». */
  pie: ReactNode;
}

/** Figma: Cuenta · Ingresar (26:414 y 26:460). La tarjeta centrada de los formularios de acceso. */
export function TarjetaCuenta({ titulo, subtitulo, children, pie }: PropsTarjetaCuenta) {
  return (
    <section className="bg-card mx-auto mt-2 flex w-full max-w-[420px] flex-col gap-5 rounded-panel border px-4 py-6 md:mt-16 md:mb-24 md:p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="titulo-1">{titulo}</h1>
        <p className="texto-base text-muted-foreground">{subtitulo}</p>
      </div>
      {children}
      <p className="texto-pequeno text-muted-foreground flex justify-center gap-1.5">{pie}</p>
    </section>
  );
}
