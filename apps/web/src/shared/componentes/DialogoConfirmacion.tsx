import { useState, type ReactNode } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';

interface PropsDialogoConfirmacion {
  titulo: string;
  /** Qué pasa si se confirma; se lee antes de decidir. */
  descripcion: string;
  textoConfirmar: string;
  /** El botón que abre el diálogo. */
  disparador: ReactNode;
  alConfirmar: () => void;
}

/**
 * Una acción que no se deshace (eliminar) pide confirmación antes de llegar al backend. El diálogo se cierra al
 * confirmar: el resultado, o el rechazo del backend, se ve donde la página ya lo muestra.
 */
export function DialogoConfirmacion({
  titulo,
  descripcion,
  textoConfirmar,
  disparador,
  alConfirmar,
}: PropsDialogoConfirmacion) {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>{disparador}</DialogTrigger>
      <DialogContent role="alertdialog">
        <DialogTitle className="titulo-2">{titulo}</DialogTitle>
        <DialogDescription className="texto-base text-muted-foreground">
          {descripcion}
        </DialogDescription>
        <div className="flex flex-wrap justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              setAbierto(false);
              alConfirmar();
            }}
          >
            {textoConfirmar}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
