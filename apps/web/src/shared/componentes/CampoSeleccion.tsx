import { useFormContext, type FieldPath, type FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';

export const CLASE_SELECT =
  'bg-card texto-base h-12 w-full rounded-md border px-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-invalid:border-2 aria-invalid:border-destructive disabled:opacity-50';

export interface OpcionNumerica {
  valor: number;
  etiqueta: string;
}

interface PropsCampoSeleccion<V extends FieldValues> {
  nombre: FieldPath<V>;
  /** Siempre visible, como en CampoFormulario. */
  etiqueta: string;
  /** El texto de la opción vacía («Elige un municipio»): sin elegir, el valor es `undefined`. */
  sinElegir: string;
  opciones: OpcionNumerica[];
  deshabilitado?: boolean;
}

/**
 * Figma: Selector (21:200) dentro de un formulario: un `select` nativo cuyo valor es un número (un ID, un mes),
 * como lo pide el esquema compartido; el error del esquema o del backend va debajo (FE-03).
 */
export function CampoSeleccion<V extends FieldValues>({
  nombre,
  etiqueta,
  sinElegir,
  opciones,
  deshabilitado = false,
}: PropsCampoSeleccion<V>) {
  const { control } = useFormContext<V>();
  return (
    <FormField
      control={control}
      name={nombre}
      render={({ field }) => (
        <FormItem className="flex flex-col gap-1.5">
          <FormLabel className="control-etiqueta text-foreground data-[error=true]:text-foreground">
            {etiqueta}
          </FormLabel>
          <FormControl>
            <select
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={typeof field.value === 'number' ? field.value : ''}
              disabled={deshabilitado}
              onChange={(evento) => {
                field.onChange(
                  evento.target.value === '' ? undefined : Number(evento.target.value),
                );
              }}
              className={CLASE_SELECT}
            >
              <option value="">{sinElegir}</option>
              {opciones.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </FormControl>
          <FormMessage className="texto-nota text-oferta" />
        </FormItem>
      )}
    />
  );
}
