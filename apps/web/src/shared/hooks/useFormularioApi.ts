import { zodResolver } from '@hookform/resolvers/zod';
import type { UseMutationResult } from '@tanstack/react-query';
import { useRef, useState, type SubmitEvent } from 'react';
import { useForm, type DefaultValues, type FieldValues, type Path } from 'react-hook-form';
import { z } from 'zod';
import { ErrorApi } from '../api';

const STATUS_VALIDACION = 400;
// El backend nombra cada campo con su origen (A-06): `body.nombreRecibe`. El formulario solo tiene el cuerpo.
const PREFIJO_CUERPO = 'body.';

// La forma de todo 400 con campos (05 §7): la de manejar (A-20) y la que arma un servicio (M1-H02).
const detallesDeValidacionSchema = z
  .object({ errores: z.array(z.object({ campo: z.string(), mensaje: z.string() })) })
  .transform(({ errores }) => errores);

/**
 * El campo de un código del backend. Con `mensaje`, el texto se arma con lo que el backend manda en `detalles`
 * (el máximo ajustable de M7-H02); sin él, va el mensaje del backend tal cual.
 */
export type CampoDelCodigo<Entrada extends FieldValues> =
  Path<Entrada> | { campo: Path<Entrada>; mensaje: (error: ErrorApi) => string };

interface OpcionesFormularioApi<Entrada extends FieldValues, Salida, Respuesta> {
  /** El esquema de `@shopcart/shared`, el mismo que valida la API (FE-03). */
  esquema: z.ZodType<Salida, Entrada>;
  /** Solo lo que el formulario usa: una mutación de TanStack o un adaptador (el pago, M4-H03). */
  mutacion: Pick<UseMutationResult<Respuesta, ErrorApi, Salida>, 'mutateAsync' | 'isPending'>;
  valoresIniciales: DefaultValues<Entrada>;
  alTerminar?: (respuesta: Respuesta) => void;
  /**
   * Los 409 o 422 que corresponden a un campo y no al formulario entero: `{ CORREO_EN_USO: 'correo' }` pone el
   * mensaje del backend en ese campo en lugar del aviso general.
   */
  campoPorCodigo?: Partial<Record<string, CampoDelCodigo<Entrada>>>;
}

/**
 * FE-03: une el formulario con su mutación y es el único lugar que traduce errores del backend. Un 400 va a cada
 * campo (`body.x` → `x`); un 409, 422, 5xx o falla de red, al aviso del formulario (`errorGeneral`).
 */
export function useFormularioApi<Entrada extends FieldValues, Salida, Respuesta>({
  esquema,
  mutacion,
  valoresIniciales,
  alTerminar,
  campoPorCodigo = {},
}: OpcionesFormularioApi<Entrada, Salida, Respuesta>) {
  const form = useForm<Entrada, unknown, Salida>({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciales,
  });
  const [errorGeneral, setErrorGeneral] = useState<ErrorApi | null>(null);
  // isPending llega en el render siguiente: un doble clic alcanzaría a enviar dos veces sin esta guarda.
  const enviandoAhora = useRef(false);

  /** Pone cada error de validación en su campo; devuelve si alguno no tenía campo en este formulario. */
  function marcarCampos(error: ErrorApi): boolean {
    const detalles = detallesDeValidacionSchema.safeParse(error.detalles);
    if (!detalles.success || detalles.data.length === 0) return true;
    const campos = Object.keys(form.getValues());
    let quedoSinCampo = false;
    for (const { campo, mensaje } of detalles.data) {
      const nombre = campo.startsWith(PREFIJO_CUERPO) ? campo.slice(PREFIJO_CUERPO.length) : null;
      const raiz = nombre?.split('.')[0];
      if (nombre === null || raiz === undefined || !campos.includes(raiz)) {
        quedoSinCampo = true;
        continue;
      }
      // El backend valida con el mismo esquema: el nombre es un campo de este formulario.
      form.setError(nombre as Path<Entrada>, { type: 'server', message: mensaje });
    }
    return quedoSinCampo;
  }

  function mostrarError(error: ErrorApi) {
    const campoDelCodigo = campoPorCodigo[error.codigo];
    if (campoDelCodigo !== undefined) {
      const { campo, mensaje } =
        typeof campoDelCodigo === 'string'
          ? { campo: campoDelCodigo, mensaje: error.mensaje }
          : { campo: campoDelCodigo.campo, mensaje: campoDelCodigo.mensaje(error) };
      form.setError(campo, { type: 'server', message: mensaje });
      return;
    }
    if (error.status !== STATUS_VALIDACION || marcarCampos(error)) setErrorGeneral(error);
  }

  async function guardar(valores: Salida) {
    if (enviandoAhora.current) return;
    enviandoAhora.current = true;
    setErrorGeneral(null);
    let respuesta: Respuesta;
    try {
      respuesta = await mutacion.mutateAsync(valores);
    } catch (error) {
      // Lo que no es ErrorApi (un 2xx que no se pudo leer, un bug) también se avisa: nunca un envío sin respuesta.
      const errorApi = error instanceof ErrorApi ? error : ErrorApi.inesperado(error);
      mostrarError(errorApi);
      return;
    } finally {
      enviandoAhora.current = false;
    }
    // Fuera del try: si falla lo que sigue a un éxito, el aviso de error invitaría a reenviar y duplicar.
    alTerminar?.(respuesta);
  }

  return {
    form,
    enviar: (evento: SubmitEvent<HTMLFormElement>) => {
      void form.handleSubmit(guardar)(evento);
    },
    errorGeneral,
    /** Mientras la mutación está en curso el botón de enviar se deshabilita (FE-02). */
    enviando: mutacion.isPending,
  };
}
