import { actualizarVarianteSchema, crearVarianteSchema } from '@shopcart/shared';
import { useId, useState, type ReactNode } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { CLASE_SELECT } from '../../../shared/componentes/CampoSeleccion';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../../shared/ui/dialog';
import { Form } from '../../../shared/ui/form';
import type { Atributo, VarianteAdmin } from '../catalogo.api';
import { useActualizarVariante, useCrearVariante } from '../hooks/useProductoAdmin';

// FE-03: el SKU repetido es del campo SKU; la combinación repetida o los atributos distintos, del aviso.
const CAMPO_POR_CODIGO = { SKU_DUPLICADO: 'sku' } as const;

function SelectorValor({
  atributo,
  elegido,
  alElegir,
}: {
  atributo: Atributo;
  elegido: number | undefined;
  alElegir: (idValor: number | undefined) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="control-etiqueta">
        {atributo.nombre}
      </label>
      <select
        id={id}
        value={elegido ?? ''}
        onChange={(evento) => {
          alElegir(evento.target.value === '' ? undefined : Number(evento.target.value));
        }}
        className={CLASE_SELECT}
      >
        <option value="">{`Sin ${atributo.nombre.toLowerCase()}`}</option>
        {atributo.valores.map((valor) => (
          <option key={valor.idValorAtributo} value={valor.idValorAtributo}>
            {valor.valor}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Un valor por atributo (N-14): el campo `valores` del esquema guarda los IDs en el orden de los atributos. Que
 * el conjunto coincida con el de las demás variantes lo valida el backend (ATRIBUTOS_NO_COINCIDEN).
 */
function CamposValores({ atributos }: { atributos: Atributo[] }) {
  const { control } = useFormContext<{ valores?: number[] }>();
  return (
    <Controller
      control={control}
      name="valores"
      render={({ field }) => {
        const elegidos = field.value ?? [];
        const deAtributo = (atributo: Atributo) =>
          atributo.valores.find((v) => elegidos.includes(v.idValorAtributo))?.idValorAtributo;
        const elegir = (atributo: Atributo, idValor: number | undefined) => {
          field.onChange(
            atributos
              .map((a) => (a.idAtributo === atributo.idAtributo ? idValor : deAtributo(a)))
              .filter((valor): valor is number => valor !== undefined),
          );
        };
        return (
          <div className="grid gap-4 sm:grid-cols-2">
            {atributos.map((atributo) => (
              <SelectorValor
                key={atributo.idAtributo}
                atributo={atributo}
                elegido={deAtributo(atributo)}
                alElegir={(idValor) => {
                  elegir(atributo, idValor);
                }}
              />
            ))}
          </div>
        );
      }}
    />
  );
}

interface PropsMarco {
  titulo: string;
  disparador: ReactNode;
  abierto: boolean;
  alCambiar: (abierto: boolean) => void;
  children: ReactNode;
}

function MarcoDialogo({ titulo, disparador, abierto, alCambiar, children }: PropsMarco) {
  return (
    <Dialog open={abierto} onOpenChange={alCambiar}>
      <DialogTrigger asChild>{disparador}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle className="display-titulo-3">{titulo}</DialogTitle>
        <DialogDescription className="texto-pequeno">
          Todas las variantes de un producto usan los mismos atributos.
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** M6-H04: una variante nueva con su SKU, un valor por atributo y el precio inicial (texto, FE-10). */
export function DialogoNuevaVariante({
  idProducto,
  atributos,
}: {
  idProducto: number;
  atributos: Atributo[];
}) {
  const [abierto, setAbierto] = useState(false);
  const formulario = useFormularioApi({
    esquema: crearVarianteSchema,
    mutacion: useCrearVariante(idProducto),
    valoresIniciales: { sku: '', valores: [], precio: '' },
    campoPorCodigo: CAMPO_POR_CODIGO,
    alTerminar: () => {
      setAbierto(false);
      formulario.form.reset();
    },
  });
  return (
    <MarcoDialogo
      titulo="Agregar variante"
      disparador={<Button variant="secondary">Agregar variante</Button>}
      abierto={abierto}
      alCambiar={setAbierto}
    >
      <Form {...formulario.form}>
        <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
          <AvisoFormulario error={formulario.errorGeneral} />
          <CampoFormulario nombre="sku" etiqueta="SKU" maxLength={40} />
          <CamposValores atributos={atributos} />
          <CampoFormulario
            nombre="precio"
            etiqueta="Precio inicial"
            inputMode="decimal"
            placeholder="0.00"
          />
          <Button type="submit" disabled={formulario.enviando}>
            Guardar variante
          </Button>
        </form>
      </Form>
    </MarcoDialogo>
  );
}

/** M6-H04: editar el SKU o la combinación (con historial no se cambia: VARIANTE_CON_HISTORIAL). */
export function DialogoEditarVariante({
  idProducto,
  variante,
  atributos,
}: {
  idProducto: number;
  variante: VarianteAdmin;
  atributos: Atributo[];
}) {
  const [abierto, setAbierto] = useState(false);
  const formulario = useFormularioApi({
    esquema: actualizarVarianteSchema,
    mutacion: useActualizarVariante(idProducto, variante.idVariante),
    valoresIniciales: {
      sku: variante.sku,
      valores: variante.valores.map((v) => v.idValorAtributo),
    },
    campoPorCodigo: CAMPO_POR_CODIGO,
    alTerminar: () => {
      setAbierto(false);
    },
  });
  return (
    <MarcoDialogo
      titulo="Editar variante"
      disparador={
        <Button variant="ghost" size="sm" aria-label={`Editar ${variante.sku}`}>
          Editar
        </Button>
      }
      abierto={abierto}
      alCambiar={setAbierto}
    >
      <Form {...formulario.form}>
        <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
          <AvisoFormulario error={formulario.errorGeneral} />
          <CampoFormulario nombre="sku" etiqueta="SKU" maxLength={40} />
          <CamposValores atributos={atributos} />
          <Button type="submit" disabled={formulario.enviando}>
            Guardar cambios
          </Button>
        </form>
      </Form>
    </MarcoDialogo>
  );
}
