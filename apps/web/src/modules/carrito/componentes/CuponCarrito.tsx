import { aplicarCuponSchema, montoSchema } from '@shopcart/shared';
import { z } from 'zod';
import type { ErrorApi } from '../../../shared/api';
import { Aviso } from '../../../shared/componentes/Aviso';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { formatearMonto } from '../../../shared/formato/monto';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import { Form } from '../../../shared/ui/form';
import type { Carrito } from '../carrito.api';
import { useAplicarCupon, useQuitarCupon } from '../hooks/useOperacionesDelCarrito';

// N-12: el rechazo por compra mínima trae en sus detalles cuánto falta (A-19).
const detallesConFaltanteSchema = z.object({ faltante: montoSchema });

function faltanteDe(error: ErrorApi | null): string | null {
  const detalles = detallesConFaltanteSchema.safeParse(error?.detalles);
  return detalles.success ? `Te faltan ${formatearMonto(detalles.data.faltante)}.` : null;
}

function FormularioCupon() {
  const formulario = useFormularioApi({
    esquema: aplicarCuponSchema,
    mutacion: useAplicarCupon(),
    valoresIniciales: { codigo: '' },
  });
  const faltante = faltanteDe(formulario.errorGeneral);
  return (
    <Form {...formulario.form}>
      <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-3">
        {/* N-12: cada rechazo trae su mensaje del backend (vencido, agotado, mínimo con el faltante…). */}
        <AvisoFormulario error={formulario.errorGeneral} />
        {faltante && <p className="texto-pequeno text-muted-foreground">{faltante}</p>}
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <CampoFormulario
              nombre="codigo"
              etiqueta="¿Tienes un cupón?"
              placeholder="Escribe tu código"
              autoComplete="off"
            />
          </div>
          <Button
            type="submit"
            variant="secondary"
            disabled={formulario.enviando}
            className="control-boton mt-7 h-auto px-5 py-3"
          >
            Aplicar
          </Button>
        </div>
      </form>
    </Form>
  );
}

function CuponAplicado({ cupon }: { cupon: NonNullable<Carrito['resumen']['cupon']> }) {
  const quitar = useQuitarCupon();
  return (
    <div className="flex flex-col gap-2">
      <Aviso tipo="exito">{`Cupón ${cupon.codigo} aplicado: ${cupon.descripcion}`}</Aviso>
      {quitar.error && <Aviso tipo="error">{quitar.error.mensaje}</Aviso>}
      <div>
        <Button
          variant="ghost"
          disabled={quitar.isPending}
          onClick={() => {
            quitar.mutate(undefined);
          }}
        >
          Quitar cupón
        </Button>
      </div>
    </div>
  );
}

/** M3-H03: el cupón del carrito. Si dejó de ser válido, el backend lo quitó y trae el motivo (N-12). */
export function CuponCarrito({ resumen }: { resumen: Carrito['resumen'] }) {
  return (
    <div className="flex flex-col gap-3">
      {resumen.cuponRetirado && <Aviso tipo="advertencia">{resumen.cuponRetirado.mensaje}</Aviso>}
      {resumen.cupon ? <CuponAplicado cupon={resumen.cupon} /> : <FormularioCupon />}
    </div>
  );
}
