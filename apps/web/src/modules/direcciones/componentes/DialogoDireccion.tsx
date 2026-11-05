import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../../shared/ui/dialog';
import type { Direccion } from '../direcciones.api';
import { FormularioEditarDireccion, FormularioNuevaDireccion } from './FormularioDireccion';

interface PropsDialogo {
  /** El botón que abre el diálogo. */
  disparador: ReactNode;
}

/** M4-H01: el formulario de una dirección nueva en un diálogo; lo usan la cuenta y el checkout (M4-H02). */
export function DialogoNuevaDireccion({
  disparador,
  alCrear,
}: PropsDialogo & { alCrear?: (direccion: Direccion) => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{disparador}</DialogTrigger>
      <DialogContent>
        <DialogTitle>Nueva dirección</DialogTitle>
        <DialogDescription>A dónde llevamos tu pedido.</DialogDescription>
        <FormularioNuevaDireccion
          alTerminar={(direccion) => {
            setAbierto(false);
            toast.success('Guardamos tu dirección.');
            alCrear?.(direccion);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

export function DialogoEditarDireccion({
  disparador,
  direccion,
}: PropsDialogo & { direccion: Direccion }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{disparador}</DialogTrigger>
      <DialogContent>
        <DialogTitle>Editar dirección</DialogTitle>
        <DialogDescription>Los cambios valen para tus próximos pedidos.</DialogDescription>
        <FormularioEditarDireccion
          direccion={direccion}
          alTerminar={() => {
            setAbierto(false);
            toast.success('Guardamos los cambios.');
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
