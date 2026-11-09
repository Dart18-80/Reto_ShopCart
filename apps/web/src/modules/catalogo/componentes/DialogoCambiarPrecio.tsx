import { cambiarPrecioSchema } from '@shopcart/shared';
import { useState } from 'react';
import { Aviso } from '../../../shared/componentes/Aviso';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { EstadoVista } from '../../../shared/componentes/EstadoVista';
import { FilaResumen } from '../../../shared/componentes/FilaResumen';
import { Monto } from '../../../shared/componentes/Monto';
import { formatearDia } from '../../../shared/formato/fecha';
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
import type { VarianteAdmin, VersionPrecio } from '../catalogo.api';
import { useCambiarPrecio, usePreciosVariante } from '../hooks/usePreciosVariante';

/** El rango de una versión en días de Guatemala, tal como llega (no se calculan fechas). */
const vigenciaDe = ({ vigenteDesde, vigenteHasta }: VersionPrecio) =>
  vigenteHasta === null
    ? `Vigente desde el ${formatearDia(vigenteDesde)}`
    : `${formatearDia(vigenteDesde)} al ${formatearDia(vigenteHasta)}`;

const SIN_HISTORIAL = { titulo: 'Sin precios todavía' };

function Historial({ idVariante, abierto }: { idVariante: number; abierto: boolean }) {
  const historial = usePreciosVariante(idVariante, { habilitado: abierto });
  return (
    <div className="flex flex-col gap-2">
      <h3 id={`historial-${String(idVariante)}`} className="texto-pequeno-fuerte">
        Historial de precios
      </h3>
      <EstadoVista
        consulta={historial}
        vacio={SIN_HISTORIAL}
        esVacio={(lista) => lista.length === 0}
      >
        {(versiones) => (
          <ul aria-labelledby={`historial-${String(idVariante)}`} className="flex flex-col gap-2">
            {versiones.map((version) => (
              <li
                key={version.idPrecioVariante}
                className="texto-pequeno flex items-baseline justify-between gap-4"
              >
                <span className="text-muted-foreground">{vigenciaDe(version)}</span>
                <Monto valor={version.precio} className="texto-pequeno-fuerte" />
              </li>
            ))}
          </ul>
        )}
      </EstadoVista>
    </div>
  );
}

/**
 * M6-H05 (Figma 48:1461): una versión nueva del precio (RF-02). El precio viaja como texto con el esquema de
 * `@shopcart/shared` (FE-10); al responder, el historial y la tabla muestran lo que confirmó el backend.
 */
export function DialogoCambiarPrecio({
  idProducto,
  variante,
}: {
  idProducto: number;
  variante: VarianteAdmin;
}) {
  const [abierto, setAbierto] = useState(false);
  const titulo = `Cambiar precio de ${variante.sku}`;
  const formulario = useFormularioApi({
    esquema: cambiarPrecioSchema,
    mutacion: useCambiarPrecio(idProducto, variante.idVariante),
    valoresIniciales: { precio: '' },
    alTerminar: () => {
      formulario.form.reset();
    },
  });

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={titulo}>
          Cambiar precio
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle className="titulo-2">{titulo}</DialogTitle>
        <DialogDescription className="sr-only">
          El precio nuevo rige desde ahora; el historial guarda cada versión.
        </DialogDescription>
        <dl>
          <FilaResumen etiqueta="Precio vigente">
            {variante.precio === null ? 'Sin precio' : <Monto valor={variante.precio} />}
          </FilaResumen>
        </dl>
        <Form {...formulario.form}>
          <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
            <AvisoFormulario error={formulario.errorGeneral} />
            <CampoFormulario
              nombre="precio"
              etiqueta="Precio nuevo"
              inputMode="decimal"
              placeholder="0.00"
              descripcion="En quetzales, con IVA incluido."
            />
            <Aviso tipo="info">
              Los pedidos ya realizados conservan su precio. Los carritos con garantía vigente pagan
              el menor de los dos.
            </Aviso>
            <Historial idVariante={variante.idVariante} abierto={abierto} />
            <div className="flex flex-wrap justify-end gap-2">
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" cargando={formulario.enviando} disabled={formulario.enviando}>
                Guardar precio
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
