import { montoMenorOIgual, pagarSchema } from '@shopcart/shared';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { Monto } from '../../../shared/componentes/Monto';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import { CreditCard } from 'lucide-react';
import { RESERVA_BARRA_TOTAL } from '../../../shared/ui/barra-fija';
import { cn } from '../../../shared/ui/cn';
import type { SesionPago } from '../checkout.api';
import { useCancelarSesionPago } from '../hooks/useCancelarSesionPago';
import { useCuentaRegresiva } from '../hooks/useCuentaRegresiva';
import { useIntentoDePago } from '../hooks/useIntentoDePago';
import { usePagar } from '../hooks/usePagar';
import { diasDeEntrega } from '../../envios';
import { desenlaceDelPago } from '../politicaDePago';
import { AvisoPago } from './AvisoPago';
import { AvisoReserva } from './AvisoReserva';
import { FormularioPago } from './FormularioPago';
import { ResumenPedido } from './ResumenPedido';
import { conId, RUTAS } from '../../../shared/rutas';

const SIN_COSTO = '0.00';
const rutaDelPedido = (idPedido: number) => `${conId(RUTAS.pedido, idPedido)}?nuevo=1`;

/** El envío congelado en la sesión: «Gratis» si su costo es cero (N-04), comparado como texto (FE-10). */
function EnvioDeLaSesion({ costo }: { costo: string }) {
  return montoMenorOIgual(costo, SIN_COSTO) ? 'Gratis' : <Monto valor={costo} />;
}

/**
 * M4-H03 (Figma 40:971 y 40:1084): paga la sesión congelada. La llave de idempotencia vive en el intento (una por
 * intento, RF-06) y la tabla de la llave decide cada respuesta (politicaDePago).
 */
export function PasoPago({ sesion }: { sesion: SesionPago }) {
  const navigate = useNavigate();
  const intento = useIntentoDePago();
  const cancelar = useCancelarSesionPago();
  const restante = useCuentaRegresiva(sesion.expiraEn);

  const volverAlCheckout = () => {
    cancelar.mutate(undefined, { onSuccess: () => void navigate(RUTAS.checkout) });
  };

  const pagar = usePagar({
    intento,
    // N-03: el número y el CVV no se quedan en la pantalla después de ninguna respuesta.
    alResponder: () => {
      formulario.form.resetField('numeroTarjeta', { keepError: true });
      formulario.form.resetField('cvv', { keepError: true });
    },
    alPagar: (pedido) => void navigate(rutaDelPedido(pedido.idPedido)),
    alPerderSesion: (desenlace, mensaje) => {
      toast.error(mensaje);
      if (desenlace.tipo === 'volverAlCheckout') volverAlCheckout();
      else void navigate(RUTAS.carrito);
    },
  });
  const formulario = useFormularioApi({
    esquema: pagarSchema,
    mutacion: pagar,
    valoresIniciales: { numeroTarjeta: '', cvv: '' },
  });

  const desenlace = pagar.error ? desenlaceDelPago(pagar.error) : null;
  const porReintentar = desenlace?.tipo === 'reintentar';

  return (
    <div
      className={cn(
        'flex flex-col gap-8 md:flex-row md:items-start md:gap-12',
        RESERVA_BARRA_TOTAL,
      )}
    >
      {/* D5: el aviso de la reserva y el formulario de la tarjeta, en una tarjeta con su ícono. */}
      <section
        aria-labelledby="titulo-tarjeta"
        className="bg-card rounded-tarjeta flex min-w-0 flex-1 flex-col gap-5 border p-4 shadow-sm md:p-6"
      >
        <h2 id="titulo-tarjeta" className="titulo-2 flex items-center gap-3">
          <CreditCard aria-hidden className="text-primary size-6" />
          Datos de la tarjeta
        </h2>
        {pagar.error && desenlace && (
          <AvisoPago
            error={pagar.error}
            desenlace={desenlace}
            alReintentar={pagar.reintentar}
            reintentando={pagar.isPending}
          />
        )}
        <AvisoReserva
          restanteMs={restante}
          alVolverAEmpezar={volverAlCheckout}
          volviendo={cancelar.isPending || porReintentar}
        />
        <FormularioPago
          form={formulario.form}
          enviar={formulario.enviar}
          deshabilitado={formulario.enviando || porReintentar || restante === 0}
          total={sesion.total}
        />
      </section>
      <div className="md:sticky md:top-[calc(var(--alto-encabezado)+1.5rem)] md:w-105 md:shrink-0">
        <ResumenPedido
          encabezado={
            <div className="flex flex-col gap-0.5">
              <p className="texto-pequeno-fuerte">{`Entrega a ${sesion.direccion.nombreRecibe}`}</p>
              <p className="texto-nota text-muted-foreground">
                {`${sesion.direccion.direccionLinea}, ${sesion.direccion.municipio}, ${sesion.direccion.departamento}. ${sesion.envio.nombre}: ${diasDeEntrega(sesion.envio.diasMin, sesion.envio.diasMax)}.`}
              </p>
            </div>
          }
          lineas={sesion.lineas.map((linea) => ({ ...linea, clave: linea.idVariante }))}
          subtotal={sesion.subtotal}
          descuento={sesion.descuento}
          codigoCupon={sesion.codigoCupon}
          envio={<EnvioDeLaSesion costo={sesion.envio.costo} />}
          total={sesion.total}
        >
          <AvisoFormulario error={cancelar.error} />
          <Button
            variant="ghost"
            cargando={cancelar.isPending}
            disabled={cancelar.isPending || pagar.isPending || porReintentar}
            onClick={volverAlCheckout}
            className="self-start px-6"
          >
            Cambiar dirección o envío
          </Button>
        </ResumenPedido>
      </div>
    </div>
  );
}
