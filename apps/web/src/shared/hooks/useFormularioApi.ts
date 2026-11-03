import { zodResolver } from '@hookform/resolvers/zod';
import type { UseMutationResult } from '@tanstack/react-query';
import { useState, type SubmitEvent } from 'react';
import { useForm, type DefaultValues, type FieldValues, type Path } from 'react-hook-form';
import { z } from 'zod';
import { ErrorApi } from '../api';

const STATUS_VALIDACION = 400;
// El backend nombra cada campo con su origen (A-06): `body.nombreRecibe`. El formulario solo tiene el cuerpo.
const PREFIJO_CUERPO = 'body.';

const detallesDeValidacionSchema = z.array(z.object({ campo: z.string(), mensaje: z.string() }));

interface OpcionesFormularioApi<Entrada extends FieldValues, Salida, Respuesta> {
  /** El esquema de `@shopcart/shared`, el mismo que valida la API (FE-03). */
  esquema: z.ZodType<Salida, Entrada>;
  mutacion: UseMutationResult<Respuesta, ErrorApi, Salida>;
  valoresIniciales: DefaultValues<Entrada>;
  alTerminar?: (respuesta: Respuesta) => void;
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
}: OpcionesFormularioApi<Entrada, Salida, Respuesta>) {
  const form = useForm<Entrada, unknown, Salida>({
    resolver: zodResolver(esquema),
    defaultValues: valoresIniciales,
  });
  const [errorGeneral, setErrorGeneral] = useState<ErrorApi | null>(null);

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

  async function guardar(valores: Salida) {
    setErrorGeneral(null);
    try {
      const respuesta = await mutacion.mutateAsync(valores);
      alTerminar?.(respuesta);
    } catch (error) {
      if (!(error instanceof ErrorApi)) throw error;
      if (error.status !== STATUS_VALIDACION || marcarCampos(error)) setErrorGeneral(error);
    }
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
