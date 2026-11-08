import { resolverReembolsoSchema } from '@shopcart/shared';
import { useState } from 'react';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { formatearMonto } from '../../../shared/formato/monto';
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
import { useResolverReembolso } from '../hooks/useRevisionManual';
import type { Reembolso } from '../pedidos.api';

/**
 * M8-H05 (E9-H04): un reembolso Fallido se resuelve a mano con el motivo y la referencia de la transferencia o
 * del depósito. El backend exige el plazo mínimo desde el último intento y consulta la pasarela antes: si ya lo
 * había procesado o no hubo cobro, responde 409 con su mensaje y la lista muestra el estado en que quedó.
 */
export function DialogoResolverReembolso({ reembolso }: { reembolso: Reembolso }) {
  const [abierto, setAbierto] = useState(false);
  const formulario = useFormularioApi({
    esquema: resolverReembolsoSchema,
    mutacion: useResolverReembolso(reembolso.idReembolso),
    valoresIniciales: { motivo: '', referencia: '' },
    alTerminar: () => {
      setAbierto(false);
    },
  });
  const titulo = `Resolver el reembolso ${String(reembolso.idReembolso)}`;

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" aria-label={titulo}>
          Resolver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="display-titulo-3">{titulo}</DialogTitle>
        <DialogDescription className="texto-pequeno">
          {`Registra cómo se devolvieron ${formatearMonto(reembolso.monto)} fuera de la pasarela. Cuenta como reembolsado.`}
        </DialogDescription>
        <Form {...formulario.form}>
          <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
            <AvisoFormulario error={formulario.errorGeneral} />
            <CampoFormulario nombre="motivo" etiqueta="Motivo" maxLength={250} />
            <CampoFormulario
              nombre="referencia"
              etiqueta="Referencia"
              maxLength={100}
              descripcion="El número de la transferencia o del depósito."
            />
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Volver
                </Button>
              </DialogClose>
              <Button type="submit" disabled={formulario.enviando}>
                Resolver
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
