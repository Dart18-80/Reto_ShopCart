import { useId, type ReactNode } from 'react';

/** Una sección de la página de perfil, en su tarjeta y con su título. */
export function SeccionPerfil({ titulo, children }: { titulo: string; children: ReactNode }) {
  const idTitulo = useId();
  return (
    <section
      aria-labelledby={idTitulo}
      className="bg-card flex max-w-[560px] flex-col gap-5 rounded-tarjeta border p-6"
    >
      <h2 id={idTitulo} className="titulo-2">
        {titulo}
      </h2>
      {children}
    </section>
  );
}
