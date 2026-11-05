import type { ComponentProps } from 'react';
import { useFormContext, type FieldPath, type FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import { Input } from '../ui/input';

// El campo controla valor, cambios, foco y estilo (Figma: Campo); el resto de las props del input pasa tal cual.
type PropsQueControlaElCampo =
  'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'ref' | 'className';

interface PropsCampoFormulario<V extends FieldValues> extends Omit<
  ComponentProps<'input'>,
  PropsQueControlaElCampo
> {
  nombre: FieldPath<V>;
  /** Siempre visible: nunca solo un `placeholder`. */
  etiqueta: string;
  /** Ayuda bajo el campo; el mensaje de error la reemplaza. */
  descripcion?: string;
  /**
   * Qué se envía si el campo queda vacío: `'ausente'` para un `.optional()` del esquema y `'nulo'` para un
   * `.nullable()` que se borra con `null` (el teléfono del perfil). Sin indicarlo, se envía el texto vacío.
   */
  vacio?: 'ausente' | 'nulo';
}

const VALOR_SI_VACIO = { ausente: undefined, nulo: null } as const;

/**
 * Figma: Campo (6:12). Etiqueta arriba, entrada y debajo la ayuda o el error (del esquema o del backend, FE-03).
 * Un monto va con `inputMode="decimal"` y `type="text"`, nunca `type="number"` (FE-10).
 */
export function CampoFormulario<V extends FieldValues>({
  nombre,
  etiqueta,
  descripcion,
  vacio,
  ...entrada
}: PropsCampoFormulario<V>) {
  const { control } = useFormContext<V>();
  return (
    <FormField
      control={control}
      name={nombre}
      render={({ field, fieldState }) => (
        <FormItem className="flex flex-col gap-1.5">
          <FormLabel className="control-etiqueta text-foreground data-[error=true]:text-foreground">
            {etiqueta}
          </FormLabel>
          <FormControl>
            <Input
              {...entrada}
              {...field}
              value={field.value ?? ''}
              onChange={(evento) => {
                const valor = evento.target.value;
                field.onChange(vacio !== undefined && valor === '' ? VALOR_SI_VACIO[vacio] : valor);
              }}
              className="bg-card texto-base h-auto px-4 py-3 md:text-base aria-invalid:border-2"
            />
          </FormControl>
          {fieldState.error ? (
            <FormMessage className="texto-nota text-oferta" />
          ) : (
            descripcion && (
              <FormDescription className="texto-nota text-muted-foreground">
                {descripcion}
              </FormDescription>
            )
          )}
        </FormItem>
      )}
    />
  );
}
