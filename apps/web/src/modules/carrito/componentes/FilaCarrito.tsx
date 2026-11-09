import type { ErrorApi } from '../../../shared/api';
import { Aviso } from '../../../shared/componentes/Aviso';
import { Cantidad } from '../../../shared/componentes/Cantidad';
import { Monto } from '../../../shared/componentes/Monto';
import { Prenda } from '../../../shared/componentes/prenda/Prenda';
import { Button } from '../../../shared/ui/button';
import { avisoDeLinea } from '../avisoDeLinea';
import type { LineaCarrito } from '../carrito.api';
import {
  useCambiarCantidad,
  useMarcarAvisosVistos,
  useQuitarLinea,
} from '../hooks/useOperacionesDelCarrito';

// Los montos llegan con dos decimales (A-21): sin descuento, la línea trae exactamente "0.00".
const SIN_DESCUENTO = '0.00';

function ErrorDeLaLinea({ error }: { error: ErrorApi | null }) {
  if (!error) return null;
  return <Aviso tipo="error">{error.mensaje}</Aviso>;
}

/**
 * Figma: Línea de carrito. Sin actualizaciones optimistas (A-02): mientras la línea cambia, su cantidad y su
 * «Eliminar» se deshabilitan y nada se mueve hasta que el backend responde con el carrito nuevo.
 */
export function FilaCarrito({ linea }: { linea: LineaCarrito }) {
  const cambiar = useCambiarCantidad(linea.idLinea);
  const quitar = useQuitarLinea(linea.idLinea);
  const marcarVistos = useMarcarAvisosVistos();
  const ocupada = cambiar.isPending || quitar.isPending;
  const aviso = avisoDeLinea(linea);

  const accionDelAviso = () => {
    if (aviso?.accion?.tipo === 'ajustar') {
      const cantidad = aviso.accion.cantidad;
      return (
        <Button
          size="sm"
          variant="outline"
          disabled={ocupada}
          onClick={() => {
            cambiar.mutate(cantidad);
          }}
        >
          {`Ajustar a ${String(cantidad)}`}
        </Button>
      );
    }
    if (aviso?.accion?.tipo === 'entendido') {
      return (
        <Button
          size="sm"
          variant="outline"
          cargando={marcarVistos.isPending}
          disabled={marcarVistos.isPending}
          onClick={() => {
            marcarVistos.mutate(undefined);
          }}
        >
          Entendido
        </Button>
      );
    }
    return undefined;
  };

  return (
    <li className="flex gap-4 border-b py-4 md:py-5">
      <div className="bg-muted flex size-24 shrink-0 items-center justify-center rounded-control md:h-28">
        <Prenda tipo={linea.ilustracion} color={linea.color ?? undefined} className="size-16" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <h2 className="texto-base-fuerte">{linea.producto}</h2>
            <p className="texto-pequeno text-muted-foreground">{linea.descripcionAtributos}</p>
            <p className="texto-pequeno text-muted-foreground">
              <Monto valor={linea.precioUnitario} /> c/u
            </p>
            {linea.descuentoLinea !== SIN_DESCUENTO && (
              <p className="texto-pequeno text-exito">
                Descuento del cupón: −<Monto valor={linea.descuentoLinea} />
              </p>
            )}
          </div>
          <Monto valor={linea.totalLinea} className="texto-base-fuerte" />
        </div>
        {aviso && (
          <Aviso tipo={aviso.tipo} acciones={accionDelAviso()}>
            {aviso.texto}
          </Aviso>
        )}
        <ErrorDeLaLinea error={cambiar.error ?? quitar.error ?? marcarVistos.error} />
        <div className="flex items-center gap-4">
          <Cantidad
            valor={linea.cantidad}
            etiqueta={`Cantidad de ${linea.producto}`}
            deshabilitada={ocupada || aviso?.bloqueaCantidad === true}
            onCambiar={(cantidad) => {
              cambiar.mutate(cantidad);
            }}
          />
          <Button
            variant="ghost-destructive"
            size="sm"
            disabled={ocupada}
            aria-label={`Eliminar ${linea.producto}`}
            onClick={() => {
              quitar.mutate(undefined);
            }}
          >
            Eliminar
          </Button>
        </div>
      </div>
    </li>
  );
}
