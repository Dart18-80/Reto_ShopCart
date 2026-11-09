import { useNavigate } from 'react-router';
import { Monto } from '../../../shared/componentes/Monto';
import { useSesion } from '../../../shared/hooks/useSesion';
import { Button } from '../../../shared/ui/button';
import type { Carrito } from '../carrito.api';
import { RUTAS } from '../../../shared/rutas';

// Un invitado ingresa primero y vuelve al checkout; al ingresar, su carrito se fusiona con el del Cliente (N-05).
const RUTA_INGRESO_AL_CHECKOUT = `${RUTAS.ingresar}?volver=${encodeURIComponent(RUTAS.checkout)}`;

/**
 * M3-H04 (Figma 38:627; en móvil, la barra fija de 38:807): «Continuar al pago». Con `puedePagar: false` el
 * backend dice que hay líneas por ajustar: el botón se deshabilita con el motivo.
 */
export function ContinuarAlPago({ resumen }: { resumen: Carrito['resumen'] }) {
  const navigate = useNavigate();
  const { tieneRol } = useSesion();
  const idMotivo = 'motivo-no-puede-pagar';

  return (
    <div className="bg-card fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t p-4 md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
      <div className="flex items-baseline justify-between md:hidden">
        <span className="texto-base-fuerte">Total</span>
        <Monto valor={resumen.total} className="display-precio" />
      </div>
      <Button
        type="button"
        disabled={!resumen.puedePagar}
        aria-describedby={resumen.puedePagar ? undefined : idMotivo}
        onClick={() => {
          void navigate(tieneRol('Cliente') ? RUTAS.checkout : RUTA_INGRESO_AL_CHECKOUT);
        }}
        className="w-full"
      >
        Continuar al pago
      </Button>
      {!resumen.puedePagar && (
        <p id={idMotivo} className="texto-nota text-muted-foreground">
          Ajusta las cantidades marcadas para continuar.
        </p>
      )}
    </div>
  );
}
