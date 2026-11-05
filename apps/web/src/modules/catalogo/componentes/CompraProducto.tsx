import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Aviso } from '../../../shared/componentes/Aviso';
import { Cantidad } from '../../../shared/componentes/Cantidad';
import { Button } from '../../../shared/ui/button';
import { useAgregarAlCarrito } from '../../carrito';

const CANTIDAD_INICIAL = 1;
const RUTA_CARRITO = '/carrito';

interface PropsCompraProducto {
  /** La variante elegida; sin ella, el botón dice qué falta. */
  idVariante: number | undefined;
  /** Los atributos que faltan por elegir, en minúscula y en su orden («talla», «color»). */
  faltan: string[];
  agotada: boolean;
}

function textoDelBoton({ faltan, agotada }: Omit<PropsCompraProducto, 'idVariante'>): string {
  if (faltan.length > 0) return `Elige ${faltan.join(' y ')}`;
  return agotada ? 'Agotado' : 'Agregar al carrito';
}

/**
 * Figma: Cantidad y «Agregar al carrito» (24:314; en móvil, la barra fija de 24:406). La cantidad no tiene más
 * límite que el que pone el backend: un 409 STOCK_INSUFICIENTE o un 422 LIMITE_LINEAS se avisan con su mensaje.
 */
export function CompraProducto({ idVariante, faltan, agotada }: PropsCompraProducto) {
  const [cantidad, setCantidad] = useState(CANTIDAD_INICIAL);
  const agregar = useAgregarAlCarrito();
  const navigate = useNavigate();
  const puedeAgregar = idVariante !== undefined && !agotada;

  return (
    <div className="flex flex-col gap-3">
      {agregar.error && <Aviso tipo="error">{agregar.error.mensaje}</Aviso>}
      <div className="bg-card fixed inset-x-0 bottom-0 z-10 flex gap-3 border-t p-4 md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
        <Cantidad valor={cantidad} onCambiar={setCantidad} deshabilitada={agregar.isPending} />
        <Button
          type="button"
          disabled={!puedeAgregar || agregar.isPending}
          onClick={() => {
            if (idVariante === undefined) return;
            agregar.mutate(
              { idVariante, cantidad },
              {
                onSuccess: () => {
                  toast.success('Agregado al carrito', {
                    action: {
                      label: 'Ver carrito',
                      onClick: () => {
                        void navigate(RUTA_CARRITO);
                      },
                    },
                  });
                },
              },
            );
          }}
          className="control-boton h-auto flex-1 px-6 py-3"
        >
          {textoDelBoton({ faltan, agotada })}
        </Button>
      </div>
    </div>
  );
}
