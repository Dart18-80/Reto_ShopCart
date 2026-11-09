import { useFormContext, type FieldPath, type FieldValues } from 'react-hook-form';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '../ui/form';
import { CLASE_SELECT } from './CampoSeleccion';

export interface OpcionDeTexto<T extends string> {
  valor: T;
  etiqueta: string;
}

interface PropsCampoOpciones<V extends FieldValues, T extends string> {
  nombre: FieldPath<V>;
  etiqueta: string;
  opciones: readonly OpcionDeTexto<T>[];
  /** La opción vacía («Elige cómo se resuelve»): sin ella, siempre hay una opción elegida. */
  sinElegir?: string;
  /** La ayuda debajo, por ejemplo qué hace la opción elegida. */
  descripcion?: string;
}

/**
 * Figma: Selector (21:200) dentro de un formulario, para un valor de texto de una lista cerrada (un `enum` del
 * esquema compartido): el tipo de cupón, la resolución de un pago. Un valor fuera de la lista queda sin elegir.
 */
export function CampoOpciones<V extends FieldValues, T extends string>({
  nombre,
  etiqueta,
  opciones,
  sinElegir,
  descripcion,
}: PropsCampoOpciones<V, T>) {
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
            <select
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={(evento) => {
                const elegida = opciones.find((o) => o.valor === evento.target.value);
                field.onChange(elegida?.valor);
              }}
              className={CLASE_SELECT}
            >
              {sinElegir !== undefined && <option value="">{sinElegir}</option>}
              {opciones.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </FormControl>
          {/* Como CampoFormulario: el error reemplaza la ayuda. */}
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
