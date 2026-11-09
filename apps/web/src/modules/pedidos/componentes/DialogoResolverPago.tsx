import { RESOLUCIONES_PAGO, resolverPagoSchema, type ResolucionPago } from '@shopcart/shared';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { CampoOpciones } from '../../../shared/componentes/CampoOpciones';
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
import { useResolverPago } from '../hooks/useRevisionManual';
import { RESOLUCION } from '../revision';
import type { PagoEnRevision, PagoResuelto } from '../pedidos.api';

interface FormularioResolverPago {
  resolucion?: ResolucionPago;
  motivo: string;
}

const OPCIONES = RESOLUCIONES_PAGO.map((valor) => ({ valor, etiqueta: RESOLUCION[valor].nombre }));

function CampoResolucion() {
  const elegida = useFormContext<FormularioResolverPago>().watch('resolucion');
  return (
    <CampoOpciones<FormularioResolverPago, ResolucionPago>
      nombre="resolucion"
      etiqueta="Resolución"
      sinElegir="Elige cómo se resuelve"
      opciones={OPCIONES}
      {...(elegida ? { descripcion: RESOLUCION[elegida].detalle } : {})}
    />
  );
}

interface PropsDialogoResolverPago {
  pago: PagoEnRevision;
  alResolver: (resultado: PagoResuelto) => void;
}

/**
 * M8-H05 (E9-H04): resolver un pago en revisión con la evidencia de la pasarela. El backend consulta la pasarela
 * y responde con su mensaje si la resolución no corresponde o si alguien lo resolvió antes.
 */
export function DialogoResolverPago({ pago, alResolver }: PropsDialogoResolverPago) {
  const [abierto, setAbierto] = useState(false);
  const formulario = useFormularioApi({
    esquema: resolverPagoSchema,
    mutacion: useResolverPago(pago.idIntentoPago),
    valoresIniciales: { motivo: '' },
    alTerminar: (resultado) => {
      setAbierto(false);
      alResolver(resultado);
    },
  });
  const titulo = `Resolver el intento ${String(pago.idIntentoPago)}`;

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="link" size="sm" aria-label={titulo}>
          Resolver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="titulo-2">{titulo}</DialogTitle>
        <DialogDescription className="texto-pequeno">
          {`${pago.numeroPedido ?? 'Sin pedido'} · ${pago.cliente.nombre} · ${formatearMonto(pago.monto)}`}
        </DialogDescription>
        <Form {...formulario.form}>
          <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
            <AvisoFormulario error={formulario.errorGeneral} />
            <CampoResolucion />
            <CampoFormulario
              nombre="motivo"
              etiqueta="Motivo"
              maxLength={250}
              descripcion="La evidencia que revisaste; queda en la bitácora."
            />
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Volver
                </Button>
              </DialogClose>
              <Button type="submit" cargando={formulario.enviando} disabled={formulario.enviando}>
                Resolver
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
