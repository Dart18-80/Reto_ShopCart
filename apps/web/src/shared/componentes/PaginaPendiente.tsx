import { useTituloPagina } from '../hooks/useTituloPagina';

/** Marcador de una página cuyo módulo todavía no se construye (F1-H05); su historia lo reemplaza. */
export function PaginaPendiente({ titulo }: { titulo: string }) {
  useTituloPagina(titulo);
  return (
    <section className="flex flex-col gap-2">
      <h1 className="titulo-1">{titulo}</h1>
      <p className="text-muted-foreground texto-base">Esta pantalla llega con su módulo.</p>
    </section>
  );
}
