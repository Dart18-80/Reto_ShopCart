import { idSchema, registrarDevolucionSchema, type RegistrarDevolucion } from '@shopcart/shared';
import type { UseMutationResult } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod';
import type { ErrorApi } from '../../../shared/api';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { CLASE_SELECT } from '../../../shared/componentes/CampoSeleccion';
import { formatearConteo } from '../../../shared/formato/conteo';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../../shared/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../../../shared/ui/form';
import type { DevolucionRegistrada, PedidoGestion } from '../pedidos.api';

type Linea = PedidoGestion['lineas'][number];

/**
 * El formulario tiene una cantidad por línea devolvible (0 = no se devuelve); al enviar quedan solo las que llevan
 * unidades y el resultado se valida con el esquema compartido (FE-03), que exige al menos una.
 */
const formularioDevolucionSchema = z
  .object({
    motivo: z.string(),
    lineas: z.array(z.object({ idDetallePedido: idSchema, cantidad: z.number().int().min(0) })),
  })
  .transform(({ motivo, lineas }) => ({
    motivo,
    lineas: lineas.filter((linea) => linea.cantidad > 0),
  }))
  .pipe(registrarDevolucionSchema);

type FormularioDevolucion = z.input<typeof formularioDevolucionSchema>;

const nombreDe = (linea: Linea) => `${linea.producto}, ${linea.descripcionVariante}`;

// Una entrada por cada línea del pedido, en su orden: los índices del formulario no cambian si una línea deja de
// ser devolvible.
const valoresDe = (pedido: PedidoGestion): FormularioDevolucion => ({
  motivo: '',
  lineas: pedido.lineas.map((linea) => ({ idDetallePedido: linea.idDetallePedido, cantidad: 0 })),
});

// La ruta del campo en el formulario. El lint pide String() en las plantillas y eso la vuelve `string`; la forma
// es la que React Hook Form espera para un elemento del arreglo.
const campoCantidad = (indice: number) =>
  `lineas.${String(indice)}.cantidad` as `lineas.${number}.cantidad`;

/** Las opciones van de 0 a lo devolvible que calculó el backend (N-10); el SP lo vuelve a exigir bajo bloqueo. */
function CantidadADevolver({ linea, indice }: { linea: Linea; indice: number }) {
  const { control, getValues, setValue } = useFormContext<FormularioDevolucion>();
  // Si otra devolución bajó lo devolvible con el diálogo abierto (se vuelve a consultar tras un 422), la cantidad
  // elegida no puede quedar fuera de las opciones.
  useEffect(() => {
    if (getValues(campoCantidad(indice)) > linea.devolvible) {
      setValue(campoCantidad(indice), linea.devolvible);
    }
  }, [getValues, setValue, indice, linea.devolvible]);
  return (
    <FormField
      control={control}
      name={campoCantidad(indice)}
      render={({ field }) => (
        <FormItem className="grid grid-cols-[1fr_6rem] items-center gap-3">
          <div className="flex min-w-0 flex-col">
            <FormLabel className="texto-pequeno-fuerte">{nombreDe(linea)}</FormLabel>
            <span className="texto-nota text-muted-foreground">
              {`SKU ${linea.sku} · ${formatearConteo(linea.devolvible, 'unidad devolvible', 'unidades devolvibles')}`}
            </span>
          </div>
          <FormControl>
            <select
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={field.value}
              onChange={(evento) => {
                field.onChange(Number(evento.target.value));
              }}
              className={CLASE_SELECT}
            >
              {Array.from({ length: linea.devolvible + 1 }, (_, cantidad) => (
                <option key={cantidad} value={cantidad}>
                  {cantidad}
                </option>
              ))}
            </select>
          </FormControl>
        </FormItem>
      )}
    />
  );
}

interface PropsDialogoDevolucion {
  pedido: PedidoGestion;
  mutacion: UseMutationResult<DevolucionRegistrada, ErrorApi, RegistrarDevolucion>;
}

/**
 * M8-H04: «Registrar devolución» con `puedeDevolver` (N-10). El diálogo sigue abierto aunque el botón desaparezca:
 * si el backend responde que el plazo venció o que ya no hay tanto que devolver, su mensaje se queda a la vista.
 */
export function DialogoDevolucion({ pedido, mutacion }: PropsDialogoDevolucion) {
  const [abierto, setAbierto] = useState(false);
  const formulario = useFormularioApi({
    esquema: formularioDevolucionSchema,
    mutacion,
    valoresIniciales: valoresDe(pedido),
    alTerminar: () => {
      setAbierto(false);
    },
  });
  // Cada vez que se abre, parte de lo devolvible de ahora (otra devolución pudo cambiarlo).
  const cambiarAbierto = (siguiente: boolean) => {
    if (siguiente) formulario.form.reset(valoresDe(pedido));
    setAbierto(siguiente);
  };
  const errorLineas = formulario.form.formState.errors.lineas;
  const mensajeLineas = errorLineas?.message ?? errorLineas?.root?.message;

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      {pedido.puedeDevolver && (
        <DialogTrigger asChild>
          <Button variant="outline">Registrar devolución</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle className="display-titulo-3">Registrar devolución</DialogTitle>
        <DialogDescription className="texto-pequeno">
          Las unidades devueltas vuelven al inventario; el reembolso se calcula con lo que se pagó
          por ellas.
        </DialogDescription>
        <Form {...formulario.form}>
          <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
            <AvisoFormulario error={formulario.errorGeneral} />
            <fieldset className="flex flex-col gap-4">
              <legend className="control-etiqueta mb-2">Cantidad a devolver</legend>
              {pedido.lineas.map(
                (linea, indice) =>
                  linea.devolvible > 0 && (
                    <CantidadADevolver key={linea.idDetallePedido} linea={linea} indice={indice} />
                  ),
              )}
              {mensajeLineas && (
                <p role="alert" className="texto-nota text-oferta">
                  {mensajeLineas}
                </p>
              )}
            </fieldset>
            <CampoFormulario nombre="motivo" etiqueta="Motivo" maxLength={250} />
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Volver
                </Button>
              </DialogClose>
              <Button type="submit" disabled={formulario.enviando}>
                Registrar devolución
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
