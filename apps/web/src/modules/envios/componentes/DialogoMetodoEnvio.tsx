import { actualizarMetodoEnvioSchema } from '@shopcart/shared';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { enteroDelCampo } from '../../../shared/formularios';
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
import type { MetodoEnvioAdmin } from '../envios.api';
import { useActualizarMetodoEnvio } from '../hooks/useMetodosAdmin';

// Los días se escriben como texto; las reglas (rango, máximo ≥ mínimo) son las del esquema compartido (FE-03).
const formularioMetodoSchema = z
  .object({
    nombre: z.string(),
    costo: z.string().trim(),
    diasMin: enteroDelCampo,
    diasMax: enteroDelCampo,
    activo: z.boolean(),
  })
  .pipe(actualizarMetodoEnvioSchema);

type CamposMetodo = z.input<typeof formularioMetodoSchema>;

const camposDe = (metodo: MetodoEnvioAdmin): CamposMetodo => ({
  nombre: metodo.nombre,
  costo: metodo.costo,
  diasMin: String(metodo.diasMin),
  diasMax: String(metodo.diasMax),
  activo: metodo.activo,
});

function CampoActivo() {
  const { control } = useFormContext<CamposMetodo>();
  return (
    <FormField
      control={control}
      name="activo"
      render={({ field }) => (
        <FormItem className="flex items-center gap-2">
          <FormControl>
            <input
              type="checkbox"
              name={field.name}
              ref={field.ref}
              checked={field.value}
              onChange={(evento) => {
                field.onChange(evento.target.checked);
              }}
              className="size-4"
            />
          </FormControl>
          <FormLabel className="texto-pequeno">Disponible en el checkout</FormLabel>
        </FormItem>
      )}
    />
  );
}

/**
 * M9-H02: editar un método con `actualizarMetodoEnvioSchema` (PUT: la representación completa). El backend no deja
 * desactivar el último método activo (409 METODO_ENVIO_ULTIMO_ACTIVO, con su mensaje en el aviso).
 */
export function DialogoMetodoEnvio({ metodo }: { metodo: MetodoEnvioAdmin }) {
  const [abierto, setAbierto] = useState(false);
  const formulario = useFormularioApi({
    esquema: formularioMetodoSchema,
    mutacion: useActualizarMetodoEnvio(metodo.idMetodoEnvio),
    valoresIniciales: camposDe(metodo),
    alTerminar: () => {
      setAbierto(false);
    },
  });
  const cambiarAbierto = (siguiente: boolean) => {
    if (siguiente) formulario.reiniciar(camposDe(metodo));
    setAbierto(siguiente);
  };

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" aria-label={`Editar ${metodo.nombre}`}>
          Editar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="display-titulo-3">{`Editar ${metodo.nombre}`}</DialogTitle>
        <DialogDescription className="texto-pequeno">
          {`Código ${metodo.codigo}. El costo es la tarifa base; el envío gratis lo decide la configuración.`}
        </DialogDescription>
        <Form {...formulario.form}>
          <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
            <AvisoFormulario error={formulario.errorGeneral} />
            <CampoFormulario nombre="nombre" etiqueta="Nombre" maxLength={50} />
            <CampoFormulario
              nombre="costo"
              etiqueta="Costo"
              inputMode="decimal"
              descripcion="En quetzales."
            />
            <div className="grid grid-cols-2 gap-4">
              <CampoFormulario nombre="diasMin" etiqueta="Días mínimos" inputMode="numeric" />
              <CampoFormulario nombre="diasMax" etiqueta="Días máximos" inputMode="numeric" />
            </div>
            <CampoActivo />
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={formulario.enviando}>
                Guardar cambios
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
