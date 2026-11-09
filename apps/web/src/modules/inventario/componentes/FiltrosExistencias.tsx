import {
  LARGO_MAXIMO_TEXTO_BUSQUEDA,
  type ConsultaExistencias,
  type OrdenExistencias,
} from '@shopcart/shared';
import { useId } from 'react';
import { CLASE_SELECT } from '../../../shared/ui/control';
import { FiltroTexto } from '../../../shared/componentes/FiltroTexto';
import type { ParametrosUrl } from '../../../shared/hooks/useParametrosUrl';

// La lista blanca del backend (M6-H01) con la dirección de cada opción; el encabezado de la tabla ordena igual.
const OPCIONES = {
  'disponible-asc': {
    etiqueta: 'Menor disponible',
    orden: { orden: 'disponible', direccion: 'asc' },
  },
  'disponible-desc': {
    etiqueta: 'Mayor disponible',
    orden: { orden: 'disponible', direccion: 'desc' },
  },
  sku: { etiqueta: 'SKU', orden: { orden: 'sku', direccion: 'asc' } },
  producto: { etiqueta: 'Producto', orden: { orden: 'producto', direccion: 'asc' } },
} as const satisfies Record<string, { etiqueta: string; orden: OrdenExistencias }>;
type ClaveOpcion = keyof typeof OPCIONES;

const esClave = (valor: string): valor is ClaveOpcion => valor in OPCIONES;

function claveDe({ orden, direccion }: OrdenExistencias): ClaveOpcion {
  if (orden === 'disponible') return direccion === 'desc' ? 'disponible-desc' : 'disponible-asc';
  // SKU y producto descendentes (desde el encabezado) se muestran con su columna.
  return orden;
}

/** Figma 48:1488: buscar por SKU o producto y el orden; todo en la URL (FE-06). */
export function FiltrosExistencias({
  parametros,
}: {
  parametros: ParametrosUrl<ConsultaExistencias>;
}) {
  const idOrden = useId();
  const { valores, cambiar } = parametros;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
      <FiltroTexto
        parametros={parametros}
        campo="texto"
        etiqueta="Buscar"
        placeholder="SKU o producto"
        maxLength={LARGO_MAXIMO_TEXTO_BUSQUEDA}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idOrden} className="control-etiqueta">
          Ordenar por
        </label>
        <select
          id={idOrden}
          value={claveDe(valores)}
          onChange={(evento) => {
            const clave = evento.target.value;
            if (esClave(clave)) cambiar(OPCIONES[clave].orden);
          }}
          className={CLASE_SELECT}
        >
          {Object.entries(OPCIONES).map(([clave, { etiqueta }]) => (
            <option key={clave} value={clave}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
