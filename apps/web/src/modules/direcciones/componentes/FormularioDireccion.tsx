import { actualizarDireccionSchema, crearDireccionSchema } from '@shopcart/shared';
import type { ReactNode } from 'react';
import { Controller } from 'react-hook-form';
import { AvisoFormulario } from '../../../shared/componentes/AvisoFormulario';
import { useFormularioApi } from '../../../shared/hooks/useFormularioApi';
import { Button } from '../../../shared/ui/button';
import { CLASE_CASILLA } from '../../../shared/ui/control';
import { Form } from '../../../shared/ui/form';
import type { Direccion } from '../direcciones.api';
import { useActualizarDireccion, useCrearDireccion } from '../hooks/useOperacionesDeDirecciones';
import { CamposDireccion } from './CamposDireccion';

function Enviar({ enviando, children }: { enviando: boolean; children: ReactNode }) {
  return (
    <Button type="submit" cargando={enviando} disabled={enviando} className="w-full">
      {children}
    </Button>
  );
}

/**
 * M4-H01: una dirección nueva. El máximo de 10 (N-17) y los demás 409/422 llegan al aviso del formulario con el
 * mensaje del backend.
 */
export function FormularioNuevaDireccion({
  alTerminar,
}: {
  alTerminar: (direccion: Direccion) => void;
}) {
  const formulario = useFormularioApi({
    esquema: crearDireccionSchema,
    mutacion: useCrearDireccion(),
    valoresIniciales: {
      nombreRecibe: '',
      telefonoRecibe: '',
      direccionLinea: '',
      esPredeterminada: false,
    },
    alTerminar,
  });
  return (
    <Form {...formulario.form}>
      <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
        <AvisoFormulario error={formulario.errorGeneral} />
        <CamposDireccion vacioOpcional="ausente" />
        <Controller
          control={formulario.form.control}
          name="esPredeterminada"
          render={({ field }) => (
            <label className="texto-base flex items-center gap-2">
              <input
                type="checkbox"
                checked={field.value === true}
                onChange={(evento) => {
                  field.onChange(evento.target.checked);
                }}
                className={CLASE_CASILLA}
              />
              Usar como predeterminada
            </label>
          )}
        />
        <Enviar enviando={formulario.enviando}>Guardar dirección</Enviar>
      </form>
    </Form>
  );
}

/** M4-H01: editar una dirección; alias o referencia vacíos se quitan (PATCH con `null`). */
export function FormularioEditarDireccion({
  direccion,
  alTerminar,
}: {
  direccion: Direccion;
  alTerminar: () => void;
}) {
  const formulario = useFormularioApi({
    esquema: actualizarDireccionSchema,
    mutacion: useActualizarDireccion(direccion.idDireccion),
    valoresIniciales: {
      alias: direccion.alias,
      nombreRecibe: direccion.nombreRecibe,
      telefonoRecibe: direccion.telefonoRecibe,
      idMunicipio: direccion.municipio.idMunicipio,
      direccionLinea: direccion.direccionLinea,
      referencia: direccion.referencia,
    },
    alTerminar,
  });
  return (
    <Form {...formulario.form}>
      <form onSubmit={formulario.enviar} noValidate className="flex flex-col gap-5">
        <AvisoFormulario error={formulario.errorGeneral} />
        <CamposDireccion
          vacioOpcional="nulo"
          idDepartamentoInicial={direccion.municipio.departamento.idDepartamento}
        />
        <Enviar enviando={formulario.enviando}>Guardar cambios</Enviar>
      </form>
    </Form>
  );
}
