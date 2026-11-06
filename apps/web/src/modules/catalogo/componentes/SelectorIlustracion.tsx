import { ILUSTRACIONES_PRENDA, type IlustracionPrenda } from '@shopcart/shared';
import { useId } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { NOMBRE_DE_LA_PRENDA, Prenda } from '../../../shared/componentes/prenda/Prenda';
import { RadioGroup, RadioGroupItem } from '../../../shared/ui/radio-group';

const esIlustracion = (valor: string): valor is IlustracionPrenda =>
  (ILUSTRACIONES_PRENDA as readonly string[]).includes(valor);

/**
 * FE-15 (M6-H02): la ilustración de la categoría, que la tienda tiñe con el color de cada variante. Cada opción
 * muestra la prenda; la lista es la misma del CHECK de la base.
 */
export function SelectorIlustracion() {
  const { control } = useFormContext<{ ilustracion?: IlustracionPrenda }>();
  const idEtiqueta = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <span id={idEtiqueta} className="control-etiqueta">
        Ilustración
      </span>
      <Controller
        control={control}
        name="ilustracion"
        render={({ field }) => (
          <RadioGroup
            aria-labelledby={idEtiqueta}
            value={field.value ?? ''}
            onValueChange={(valor) => {
              if (esIlustracion(valor)) field.onChange(valor);
            }}
            className="grid grid-cols-3 gap-2 sm:grid-cols-6"
          >
            {ILUSTRACIONES_PRENDA.map((tipo) => (
              <label
                key={tipo}
                className="has-data-[state=checked]:border-ring has-data-[state=checked]:bg-secondary flex cursor-pointer flex-col items-center gap-1 rounded-md border p-2"
              >
                <span aria-hidden>
                  <Prenda tipo={tipo} className="size-12" />
                </span>
                <span className="texto-nota flex items-center gap-1.5">
                  <RadioGroupItem value={tipo} />
                  {NOMBRE_DE_LA_PRENDA[tipo]}
                </span>
              </label>
            ))}
          </RadioGroup>
        )}
      />
    </div>
  );
}
