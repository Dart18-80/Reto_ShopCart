import { LogOut } from 'lucide-react';
import { useCerrarSesion } from '../../shared/hooks/useCerrarSesion';
import { Button } from '../../shared/ui/button';

const ETIQUETA = 'Cerrar sesión';

/** Cierra la sesión en el servidor y en todas las pestañas; el guardián lleva a ingresar si la ruta lo pide. */
export function BotonCerrarSesion({ variante }: { variante: 'icono' | 'texto' }) {
  const cerrarSesion = useCerrarSesion();
  const soloIcono = variante === 'icono';
  return (
    <Button
      variant="ghost"
      size={soloIcono ? 'icon' : 'sm'}
      aria-label={soloIcono ? ETIQUETA : undefined}
      disabled={cerrarSesion.isPending}
      onClick={() => {
        cerrarSesion.mutate();
      }}
    >
      <LogOut aria-hidden className="size-4.5" />
      {!soloIcono && ETIQUETA}
    </Button>
  );
}
