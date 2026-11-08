import {
  cambiarEstadoPedidoSchema,
  type CambiarEstadoPedido,
  type EstadoPedido,
} from '@shopcart/shared';
import type { UseMutationResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { ErrorApi } from '../../../shared/api';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { nombreDelEstado } from '../../../shared/componentes/EstadoPedido';
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
import type { Pedido } from '../pedidos.api';

// Figma 26:519 y el backlog (M8-H03): cómo se pide cada paso del ciclo (N-08).
const ACCION: Partial<Record<EstadoPedido, string>> = {
  EnPreparacion: 'Pasar a En preparación',
  Despachado: 'Marcar como despachado',
  Entregado: 'Marcar como entregado',
};

const accionHacia = (estado: EstadoPedido) =>
  ACCION[estado] ?? `Pasar a ${nombreDelEstado(estado)}`;

// El diálogo solo edita el motivo; los estados los pone la página con lo que se está viendo.
const formularioMotivoSchema = cambiarEstadoPedidoSchema.pick({ motivo: true });

interface PropsDialogoCambiarEstado {
  /** El estado que se está viendo: es el `estadoEsperado` de la concurrencia optimista. */
  estadoActual: EstadoPedido;
  estadoNuevo: EstadoPedido;
  numeroPedido: string;
  mutacion: UseMutationResult<Pedido, ErrorApi, CambiarEstadoPedido>;
}

/** M8-H03: un paso del ciclo con su motivo opcional; el backend vuelve a validar la transición bajo bloqueo. */
export function DialogoCambiarEstado({
  estadoActual,
  estadoNuevo,
  numeroPedido,
  mutacion,
}: PropsDialogoCambiarEstado) {
  const [abierto, setAbierto] = useState(false);
  const accion = accionHacia(estadoNuevo);
  const formulario = useFormularioApi({
    esquema: formularioMotivoSchema,
    mutacion: {
      isPending: mutacion.isPending,
      mutateAsync: ({ motivo }) =>
        mutacion.mutateAsync({ estadoEsperado: estadoActual, estadoNuevo, motivo }),
    },
    valoresIniciales: {},
    alTerminar: () => {
      setAbierto(false);
    },
  });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>{accion}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="display-titulo-3">{accion}</DialogTitle>
        <DialogDescription className="texto-pequeno">
          {`El pedido ${numeroPedido} pasa de ${nombreDelEstado(estadoActual)} a ${nombreDelEstado(estadoNuevo)}.`}
        </DialogDescription>
        <Form {...formulario.form}>
          <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
            <AvisoFormulario error={formulario.errorGeneral} />
            <CampoFormulario
              nombre="motivo"
              etiqueta="Motivo (opcional)"
              maxLength={250}
              vacio="ausente"
              descripcion="Queda en el historial del pedido."
            />
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Volver
                </Button>
              </DialogClose>
              <Button type="submit" disabled={formulario.enviando}>
                {accion}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
