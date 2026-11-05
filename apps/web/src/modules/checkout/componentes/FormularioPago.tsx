import type { Pagar } from '@shopcart/shared';
import type { SubmitEvent } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Aviso } from '../../../shared/componentes/Aviso';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { CampoSeleccion, type OpcionNumerica } from '../../../shared/componentes/CampoSeleccion';
import { Monto } from '../../../shared/componentes/Monto';
import { formatearMonto } from '../../../shared/formato/monto';
import { Button } from '../../../shared/ui/button';
import { Form } from '../../../shared/ui/form';

const MESES: OpcionNumerica[] = Array.from({ length: 12 }, (_, indice) => ({
  valor: indice + 1,
  etiqueta: String(indice + 1).padStart(2, '0'),
}));
// La vigencia la valida el backend (su 400 marca el año); aquí solo se ofrecen los próximos años.
const ANIOS_OFRECIDOS = 11;
const anios = (): OpcionNumerica[] => {
  const actual = new Date().getFullYear();
  return Array.from({ length: ANIOS_OFRECIDOS }, (_, indice) => ({
    valor: actual + indice,
    etiqueta: String(actual + indice),
  }));
};

interface PropsFormularioPago {
  form: UseFormReturn<Pagar, unknown, Pagar>;
  enviar: (evento: SubmitEvent<HTMLFormElement>) => void;
  /** Mientras se paga, con un pago por reintentar o con la reserva vencida, no se puede escribir ni enviar. */
  deshabilitado: boolean;
  total: string;
}

/**
 * M4-H03 (Figma 40:971 y, en móvil, la barra fija de 40:1084): los datos de la tarjeta con el esquema de
 * `@shopcart/shared`. El número y el CVV nunca se guardan ni se registran: solo viajan a la pasarela (N-03).
 */
export function FormularioPago({ form, enviar, deshabilitado, total }: PropsFormularioPago) {
  return (
    <Form {...form}>
      <form onSubmit={enviar} noValidate aria-label="Datos de la tarjeta">
        <fieldset disabled={deshabilitado} className="flex flex-col gap-5">
          <CampoFormulario<Pagar>
            nombre="numeroTarjeta"
            etiqueta="Número de tarjeta"
            inputMode="numeric"
            autoComplete="cc-number"
            maxLength={19}
          />
          <div className="grid grid-cols-[auto_auto_1fr] items-start gap-4">
            <CampoSeleccion<Pagar>
              nombre="mesVencimiento"
              etiqueta="Mes"
              sinElegir="MM"
              opciones={MESES}
            />
            <CampoSeleccion<Pagar>
              nombre="anioVencimiento"
              etiqueta="Año"
              sinElegir="AAAA"
              opciones={anios()}
            />
            <CampoFormulario<Pagar>
              nombre="cvv"
              etiqueta="CVV"
              type="password"
              inputMode="numeric"
              autoComplete="cc-csc"
              maxLength={4}
            />
          </div>
          <Aviso tipo="info">
            Pasarela de prueba: 4242 4242 4242 4242 aprueba; 4000 0000 0000 0002 se rechaza por
            fondos insuficientes.
          </Aviso>
          <div className="bg-card fixed inset-x-0 bottom-0 z-10 flex flex-col gap-2 border-t p-4 md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
            <div className="flex items-baseline justify-between md:hidden">
              <span className="texto-base-fuerte">Total</span>
              <Monto valor={total} className="display-precio" />
            </div>
            <Button type="submit" className="control-boton h-auto w-full px-6 py-3">
              {`Pagar ${formatearMonto(total)}`}
            </Button>
          </div>
          <p className="texto-nota text-muted-foreground">
            No guardamos los datos de tu tarjeta: solo viajan a la pasarela de pago.
          </p>
        </fieldset>
      </form>
    </Form>
  );
}
