import { LARGO_MAXIMO_TEXTO_BUSQUEDA } from '@shopcart/shared';
import { useId, useState } from 'react';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { CampoSeleccion } from '../../../shared/componentes/CampoSeleccion';
import { useDebounce } from '../../../shared/hooks/useDebounce';
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
import { Input } from '../../../shared/ui/input';
import { formularioEntradaSchema } from '../formularios';
import { useExistencias } from '../hooks/useExistencias';
import { useRegistrarEntrada } from '../hooks/useMovimientos';
import { nombreDeVariante } from '../nombreDeVariante';

const TITULO = 'Registrar entrada';
const OPCIONES_A_MOSTRAR = 10;
const VALORES_INICIALES = { cantidad: '', motivo: '', referencia: '' };
const CAMPO_POR_CODIGO = { MOTIVO_REQUERIDO: 'motivo' } as const;

/** Las variantes que coinciden con lo que se escribe, por SKU, con la búsqueda de existencias (M7-H01). */
function useOpcionesDeVariante(texto: string) {
  const busqueda = useDebounce(texto.trim());
  const existencias = useExistencias({
    pagina: 1,
    tamano: OPCIONES_A_MOSTRAR,
    orden: 'sku',
    direccion: 'asc',
    texto: busqueda === '' ? undefined : busqueda,
  });
  return (existencias.data?.datos ?? []).map((e) => ({
    valor: e.idVariante,
    etiqueta: `${e.sku} · ${nombreDeVariante(e)}`,
  }));
}

function FormularioEntrada({ alTerminar }: { alTerminar: () => void }) {
  const idBusqueda = useId();
  const [texto, setTexto] = useState('');
  const opciones = useOpcionesDeVariante(texto);
  const formulario = useFormularioApi({
    esquema: formularioEntradaSchema,
    mutacion: useRegistrarEntrada(),
    valoresIniciales: VALORES_INICIALES,
    campoPorCodigo: CAMPO_POR_CODIGO,
    alTerminar,
  });

  return (
    <Form {...formulario.form}>
      <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
        <AvisoFormulario error={formulario.errorGeneral} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idBusqueda} className="control-etiqueta">
            Buscar variante
          </label>
          <Input
            id={idBusqueda}
            value={texto}
            maxLength={LARGO_MAXIMO_TEXTO_BUSQUEDA}
            placeholder="SKU o producto"
            onChange={(evento) => {
              setTexto(evento.target.value);
              // Una variante elegida que ya no está en la lista no se envía a escondidas.
              formulario.form.resetField('idVariante');
            }}
            className="bg-card texto-base h-auto px-4 py-3 md:text-base"
          />
        </div>
        <CampoSeleccion
          nombre="idVariante"
          etiqueta="Variante"
          sinElegir="Elige una variante"
          opciones={opciones}
        />
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <CampoFormulario nombre="cantidad" etiqueta="Cantidad" inputMode="numeric" />
          <CampoFormulario nombre="motivo" etiqueta="Motivo" descripcion="Obligatorio." />
        </div>
        <CampoFormulario
          nombre="referencia"
          etiqueta="Referencia"
          descripcion="Opcional: la factura o el documento de la compra."
          vacio="ausente"
        />
        <div className="flex flex-wrap justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={formulario.enviando}>
            {TITULO}
          </Button>
        </div>
      </form>
    </Form>
  );
}

/**
 * M7-H02: una entrada de inventario (N-16). La variante se elige buscándola; al registrar, el diálogo se cierra
 * y las existencias, el kardex y la conciliación se vuelven a pedir.
 */
export function DialogoRegistrarEntrada() {
  const [abierto, setAbierto] = useState(false);
  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger asChild>
        <Button>{TITULO}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle className="display-titulo-3">{TITULO}</DialogTitle>
        <DialogDescription className="sr-only">
          Unidades que entran al inventario de una variante, con su motivo y su referencia.
        </DialogDescription>
        {/* El contenido se desmonta al cerrar: cada apertura empieza con el formulario vacío. */}
        <FormularioEntrada
          alTerminar={() => {
            setAbierto(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
