import { CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * D5: el encabezado de la confirmación (`?nuevo=1`): el check se dibuja una vez (D2, `animar-trazo`) y el texto es
 * el mismo agradecimiento de siempre. Se anuncia como estado, igual que el aviso que reemplaza.
 */
export function ExitoDelPedido({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="bg-exito-suave rounded-panel flex flex-col items-center gap-3 px-6 py-8 text-center"
    >
      <span className="bg-card flex size-16 items-center justify-center rounded-full shadow-xs">
        <CircleCheck aria-hidden className="animar-trazo text-exito size-10" />
      </span>
      <p className="texto-base-fuerte max-w-lg">{children}</p>
    </div>
  );
}
