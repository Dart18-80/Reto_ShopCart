import {
  ESTADOS_PEDIDO,
  LARGO_MAXIMO_TEXTO_BUSQUEDA,
  type ConsultaPedidosGestion,
} from '@shopcart/shared';
import { useId } from 'react';
import { CLASE_SELECT } from '../../../shared/ui/control';
import { nombreDelEstado } from '../../../shared/componentes/EstadoPedido';
import { FiltroRangoFechas } from '../../../shared/componentes/FiltroRangoFechas';
import { FiltroTexto } from '../../../shared/componentes/FiltroTexto';
import type { ParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import { esEstadoPedido } from '../estados';

/**
 * Figma 26:519: el cliente por nombre o correo, el estado y el rango de días de Guatemala; todo en la URL y
 * resuelto por el servidor (RF-08, FE-06).
 */
export function FiltrosPedidosGestion({
  parametros,
}: {
  parametros: ParametrosUrl<ConsultaPedidosGestion>;
}) {
  const idEstado = useId();
  const { valores, cambiar } = parametros;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-[1fr_10rem_10rem_10rem]">
      <div className="col-span-2 flex md:col-span-1">
        <FiltroTexto
          parametros={parametros}
          campo="cliente"
          etiqueta="Cliente"
          placeholder="Nombre o correo"
          maxLength={LARGO_MAXIMO_TEXTO_BUSQUEDA}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5 md:col-span-1">
        <label htmlFor={idEstado} className="control-etiqueta">
          Estado
        </label>
        <select
          id={idEstado}
          value={valores.estado ?? ''}
          onChange={(evento) => {
            const valor = evento.target.value;
            cambiar({ estado: esEstadoPedido(valor) ? valor : undefined });
          }}
          className={CLASE_SELECT}
        >
          <option value="">Todos</option>
          {ESTADOS_PEDIDO.map((estado) => (
            <option key={estado} value={estado}>
              {nombreDelEstado(estado)}
            </option>
          ))}
        </select>
      </div>
      <FiltroRangoFechas parametros={parametros} />
    </div>
  );
}
