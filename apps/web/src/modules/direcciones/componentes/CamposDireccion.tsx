import { useId, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { CampoFormulario } from '../../../shared/componentes/CampoFormulario';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../shared/ui/form';
import { useDepartamentos, useMunicipios } from '../hooks/useDirecciones';

const CLASE_SELECT =
  'bg-card texto-base h-12 w-full rounded-md border px-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-invalid:border-2 aria-invalid:border-destructive disabled:opacity-50';

interface PropsCamposDireccion {
  /** El departamento del municipio guardado, al editar. */
  idDepartamentoInicial?: number;
  /** Alias y referencia vacíos: ausentes al crear, `null` al editar (los quita, PATCH). */
  vacioOpcional: 'ausente' | 'nulo';
}

/**
 * Los campos de una dirección (M4-H01), compartidos por crear y editar. El departamento solo sirve para elegir el
 * municipio: no viaja al backend. Al cambiarlo, el municipio elegido se limpia.
 */
export function CamposDireccion({ idDepartamentoInicial, vacioOpcional }: PropsCamposDireccion) {
  const { control, setValue } = useFormContext();
  const [idDepartamento, setIdDepartamento] = useState(idDepartamentoInicial);
  const departamentos = useDepartamentos();
  const municipios = useMunicipios(idDepartamento);
  const idSelectDepartamento = useId();

  return (
    <>
      <CampoFormulario
        nombre="alias"
        etiqueta="Alias (opcional)"
        placeholder="Casa, oficina…"
        vacio={vacioOpcional}
      />
      <CampoFormulario nombre="nombreRecibe" etiqueta="Quién recibe" autoComplete="name" />
      <CampoFormulario
        nombre="telefonoRecibe"
        etiqueta="Teléfono"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        descripcion="8 dígitos."
      />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={idSelectDepartamento} className="control-etiqueta">
            Departamento
          </label>
          <select
            id={idSelectDepartamento}
            value={idDepartamento ?? ''}
            disabled={departamentos.isPending}
            onChange={(evento) => {
              const elegido = evento.target.value === '' ? undefined : Number(evento.target.value);
              setIdDepartamento(elegido);
              setValue('idMunicipio', undefined);
            }}
            className={CLASE_SELECT}
          >
            <option value="">Elige un departamento</option>
            {departamentos.data?.map((departamento) => (
              <option key={departamento.idDepartamento} value={departamento.idDepartamento}>
                {departamento.nombre}
              </option>
            ))}
          </select>
          {departamentos.isError && (
            <p className="texto-nota text-oferta">{departamentos.error.mensaje}</p>
          )}
        </div>
        <FormField
          control={control}
          name="idMunicipio"
          render={({ field }) => (
            <FormItem className="flex flex-col gap-1.5">
              <FormLabel className="control-etiqueta text-foreground data-[error=true]:text-foreground">
                Municipio
              </FormLabel>
              <FormControl>
                <select
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={typeof field.value === 'number' ? field.value : ''}
                  disabled={idDepartamento === undefined || municipios.isPending}
                  onChange={(evento) => {
                    field.onChange(
                      evento.target.value === '' ? undefined : Number(evento.target.value),
                    );
                  }}
                  className={CLASE_SELECT}
                >
                  <option value="">Elige un municipio</option>
                  {municipios.data?.map((municipio) => (
                    <option key={municipio.idMunicipio} value={municipio.idMunicipio}>
                      {municipio.nombre}
                    </option>
                  ))}
                </select>
              </FormControl>
              <FormMessage className="texto-nota text-oferta" />
            </FormItem>
          )}
        />
      </div>
      <CampoFormulario nombre="direccionLinea" etiqueta="Dirección" autoComplete="street-address" />
      <CampoFormulario
        nombre="referencia"
        etiqueta="Referencia (opcional)"
        placeholder="Portón negro, frente al parque…"
        vacio={vacioOpcional}
      />
    </>
  );
}
