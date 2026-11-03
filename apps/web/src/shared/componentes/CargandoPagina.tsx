import { LoaderCircle } from 'lucide-react';

/** Mientras llega el código de una página o se verifica la sesión. */
export function CargandoPagina({ mensaje = 'Cargando…' }: { mensaje?: string }) {
  return (
    <div
      role="status"
      className="text-muted-foreground texto-base flex items-center justify-center gap-2 p-12"
    >
      <LoaderCircle aria-hidden className="size-5 animate-spin" />
      {mensaje}
    </div>
  );
}
