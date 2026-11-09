import { useId, type ReactNode } from 'react';

/** Una tarjeta del detalle (Figma 47:1222): Artículos, Seguimiento, Entrega y Pago, cada una con su título. */
export function SeccionPedido({ titulo, children }: { titulo: string; children: ReactNode }) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className="bg-card flex flex-col gap-3.5 rounded-tarjeta border p-6"
    >
      <h2 id={id} className="titulo-2">
        {titulo}
      </h2>
      {children}
    </section>
  );
}
