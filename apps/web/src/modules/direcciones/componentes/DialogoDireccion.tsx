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

// El formulario es largo: en un teléfono el diálogo se desplaza en lugar de salirse de la pantalla.
const CONTENIDO = 'max-h-[90dvh] overflow-y-auto';
const TITULO = 'titulo-2';
const DESCRIPCION = 'texto-pequeno';

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
      <DialogContent className={CONTENIDO}>
        <DialogTitle className={TITULO}>Nueva dirección</DialogTitle>
        <DialogDescription className={DESCRIPCION}>A dónde llevamos tu pedido.</DialogDescription>
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
      <DialogContent className={CONTENIDO}>
        <DialogTitle className={TITULO}>Editar dirección</DialogTitle>
        <DialogDescription className={DESCRIPCION}>
          Los cambios valen para tus próximos pedidos.
        </DialogDescription>
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
