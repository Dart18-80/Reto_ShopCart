import { cancelarPedidoSchema, type CancelarPedido } from '@shopcart/shared';
import type { UseMutationResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ErrorApi } from '../../../shared/api';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
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
import { Form } from '../../../shared/ui/form';
import type { Cancelacion } from '../pedidos.api';

interface PropsDialogoCancelarPedido {
  /** El backend decide si se puede (M5-H01); sin eso no hay botón. */
  puedeCancelar: boolean;
  mutacion: UseMutationResult<Cancelacion, ErrorApi, CancelarPedido>;
  /** Qué pasa al cancelar, dicho a quien cancela: el Cliente o el personal (M8-H03). */
  descripcion: string;
}

/**
 * M5-H02: el motivo es obligatorio con el mismo esquema que la API (N-09). El diálogo sigue abierto aunque el
 * botón desaparezca: si el backend responde que ya no se puede cancelar, su mensaje se queda a la vista.
 */
export function DialogoCancelarPedido({
  puedeCancelar,
  mutacion,
  descripcion,
}: PropsDialogoCancelarPedido) {
  const [abierto, setAbierto] = useState(false);
  const formulario = useFormularioApi({
    esquema: cancelarPedidoSchema,
    mutacion,
    valoresIniciales: { motivo: '' },
    alTerminar: () => {
      setAbierto(false);
    },
  });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      {puedeCancelar && (
        <DialogTrigger asChild>
          <Button variant="outline" className="px-6">
            Cancelar pedido
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <DialogTitle className="titulo-2">Cancelar el pedido</DialogTitle>
        <DialogDescription className="texto-pequeno">{descripcion}</DialogDescription>
        <Form {...formulario.form}>
          <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
            <AvisoFormulario error={formulario.errorGeneral} />
            <CampoFormulario nombre="motivo" etiqueta="Motivo" maxLength={250} />
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Volver
                </Button>
              </DialogClose>
              <Button
                type="submit"
                variant="destructive"
                cargando={formulario.enviando}
                disabled={formulario.enviando}
              >
                Cancelar pedido
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
