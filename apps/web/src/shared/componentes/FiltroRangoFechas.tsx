import { useId } from 'react';
import type { ParametrosUrl } from '../hooks/useParametrosUrl';
import { CLASE_SELECT } from './CampoSeleccion';

/** Lo que toda consulta con rango de días de Guatemala tiene (`rangoDeFechasSchema`, A-12). */
interface ConRango {
  desde?: string;
  hasta?: string;
}

function CampoDia({
  etiqueta,
  valor,
  minimo,
  maximo,
  alCambiar,
}: {
  etiqueta: string;
  valor: string | undefined;
  minimo?: string;
  maximo?: string;
  alCambiar: (valor: string | undefined) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="control-etiqueta">
        {etiqueta}
      </label>
      <input
        id={id}
        type="date"
        value={valor ?? ''}
        min={minimo}
        max={maximo}
        onChange={(evento) => {
          alCambiar(evento.target.value === '' ? undefined : evento.target.value);
        }}
        className={CLASE_SELECT}
      />
    </div>
  );
}

/**
 * FE-10: «Desde» y «Hasta» como días de Guatemala (AAAA-MM-DD, el valor nativo de `<input type="date">`), en la
 * URL. Cada extremo limita al otro; si la URL trae un rango invertido, el esquema descarta «Desde» (el backend
 * respondería 400 con la misma regla).
 */
export function FiltroRangoFechas<C extends ConRango>({
  parametros,
}: {
  parametros: ParametrosUrl<C>;
}) {
  const { valores, cambiar } = parametros;
  // C extiende ConRango: desde y hasta admiten un día o undefined (igual que FiltroTexto con su campo).
  return (
    <>
      <CampoDia
        etiqueta="Desde"
        valor={valores.desde}
        maximo={valores.hasta}
        alCambiar={(desde) => {
          cambiar({ desde } as Partial<C>);
        }}
      />
      <CampoDia
        etiqueta="Hasta"
        valor={valores.hasta}
        minimo={valores.desde}
        alCambiar={(hasta) => {
          cambiar({ hasta } as Partial<C>);
        }}
      />
    </>
  );
}
