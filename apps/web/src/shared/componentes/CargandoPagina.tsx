import { LoaderCircle } from 'lucide-react';
import { BarraProgreso } from './BarraProgreso';

/** D3: mientras llega el código de un área diferida, una barra de 2 px arriba de la ventana. */
export function CargandoArea() {
  return (
    <div role="status">
      <span className="sr-only">Cargando…</span>
      <BarraProgreso className="fixed inset-x-0 top-0 z-50" />
    </div>
  );
}

/** Mientras se verifica la sesión. */
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
