import { zodResolver } from '@hookform/resolvers/zod';
import { filtroPrecioSchema, type ConsultaBusqueda, type FiltroPrecio } from '@shopcart/shared';
import { useId, useMemo, type FocusEvent } from 'react';
import { useForm } from 'react-hook-form';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { Button } from '../../../shared/ui/button';
import { Form } from '../../../shared/ui/form';

interface PropsFiltrosCatalogo {
  valores: ConsultaBusqueda;
  onCambiar: (cambios: Partial<ConsultaBusqueda>) => void;
  onLimpiar: () => void;
}

/**
 * El rango de precio se valida con el mismo esquema que la query del backend (FE-03) y se aplica al salir del par
 * de campos o con Enter: así un rango a medio escribir no consulta. Un rango inválido muestra el mensaje del
 * esquema y la URL no cambia. Los campos siguen a la URL (Limpiar filtros, «atrás»).
 */
function RangoDePrecio({ valores, onCambiar }: Omit<PropsFiltrosCatalogo, 'onLimpiar'>) {
  const desdeLaUrl = useMemo<FiltroPrecio>(
    () => ({ precioMin: valores.precioMin, precioMax: valores.precioMax }),
    [valores.precioMin, valores.precioMax],
  );
  const form = useForm<FiltroPrecio>({
    resolver: zodResolver(filtroPrecioSchema),
    values: desdeLaUrl,
  });
  const aplicar = form.handleSubmit((rango) => {
    if (rango.precioMin !== valores.precioMin || rango.precioMax !== valores.precioMax) {
      onCambiar(rango);
    }
  });

  return (
    <Form {...form}>
      <form
        aria-label="Rango de precio"
        noValidate
        onSubmit={(evento) => {
          void aplicar(evento);
        }}
        onBlur={(evento: FocusEvent<HTMLFormElement>) => {
          if (
            evento.relatedTarget instanceof Node &&
            evento.currentTarget.contains(evento.relatedTarget)
          ) {
            return;
          }
          void aplicar();
        }}
        className="grid grid-cols-2 items-start gap-3"
      >
        <CampoFormulario
          nombre="precioMin"
          etiqueta="Precio mínimo"
          inputMode="decimal"
          placeholder="Q0"
          vacio="ausente"
        />
        <CampoFormulario
          nombre="precioMax"
          etiqueta="Precio máximo"
          inputMode="decimal"
          placeholder="Sin límite"
          vacio="ausente"
        />
        {/* Enter en un campo aplica el rango. */}
        <button type="submit" hidden />
      </form>
    </Form>
  );
}

/** Figma: Filtros del catálogo (22:62): precio, «Solo con existencia» y Limpiar filtros. */
export function FiltrosCatalogo({ valores, onCambiar, onLimpiar }: PropsFiltrosCatalogo) {
  const idExistencia = useId();
  return (
    <div className="flex flex-col gap-5">
      <RangoDePrecio valores={valores} onCambiar={onCambiar} />
      <div className="flex items-center gap-2">
        <input
          id={idExistencia}
          type="checkbox"
          checked={valores.disponible === true}
          onChange={(evento) => {
            onCambiar({ disponible: evento.target.checked ? true : undefined });
          }}
          className="accent-primary size-4"
        />
        <label htmlFor={idExistencia} className="texto-base">
          Solo con existencia
        </label>
      </div>
      <div>
        <Button type="button" variant="ghost" onClick={onLimpiar}>
          Limpiar filtros
        </Button>
      </div>
    </div>
  );
}
