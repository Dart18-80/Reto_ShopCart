import type { RegistrarAjuste } from '@shopcart/shared';
import { z } from 'zod';
import type { ErrorApi } from '../../../shared/api';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import { DialogClose } from '../../../shared/ui/dialog';
import { Form } from '../../../shared/ui/form';
import { formularioAjusteSchema, type FormularioAjuste as ValoresAjuste } from '../formularios';
import { useRegistrarAjuste } from '../hooks/useMovimientos';
import type { Existencia } from '../inventario.api';

// A-19: el SP manda en detalles cuánto se puede restar sin bajar de lo reservado (50303).
const detallesBajoReservadoSchema = z.object({ maximoAjustable: z.int().nonnegative() });

function mensajeBajoReservado(error: ErrorApi): string {
  const detalles = detallesBajoReservadoSchema.safeParse(error.detalles);
  return detalles.success
    ? `${error.mensaje} Puedes restar hasta ${String(detalles.data.maximoAjustable)}.`
    : error.mensaje;
}

// Los errores del ajuste son de un campo (M7-H02); 50302 llega sin detalles y va con el mensaje del backend.
const CAMPO_POR_CODIGO = {
  MOTIVO_REQUERIDO: 'motivo',
  AJUSTE_DEJA_NEGATIVO: 'cantidad',
  AJUSTE_BAJO_RESERVADO: { campo: 'cantidad', mensaje: mensajeBajoReservado },
} as const;

const VALORES_INICIALES = { cantidad: '', motivo: '' };

/**
 * M7-H02 (Figma 48:1617): la cantidad con signo y el motivo obligatorio. El límite lo decide el SP bajo bloqueo
 * (A-02); la ayuda solo muestra lo reservado que mandó el backend.
 */
export function FormularioAjuste({ existencia }: { existencia: Existencia }) {
  const ajuste = useRegistrarAjuste();
  const formulario = useFormularioApi({
    esquema: formularioAjusteSchema,
    mutacion: {
      isPending: ajuste.isPending,
      mutateAsync: (valores: ValoresAjuste) =>
        ajuste.mutateAsync({
          ...valores,
          idVariante: existencia.idVariante,
        } satisfies RegistrarAjuste),
    },
    valoresIniciales: VALORES_INICIALES,
    campoPorCodigo: CAMPO_POR_CODIGO,
    alTerminar: () => {
      formulario.form.reset(VALORES_INICIALES);
    },
  });

  return (
    <Form {...formulario.form}>
      <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
        <AvisoFormulario error={formulario.errorGeneral} />
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <CampoFormulario
            nombre="cantidad"
            etiqueta="Cantidad"
            inputMode="numeric"
            descripcion={`Negativo para restar. No puede quedar por debajo de lo reservado (${String(existencia.reservado)}).`}
          />
          <CampoFormulario nombre="motivo" etiqueta="Motivo" descripcion="Obligatorio." />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" disabled={formulario.enviando}>
            Registrar ajuste
          </Button>
        </div>
      </form>
    </Form>
  );
}
