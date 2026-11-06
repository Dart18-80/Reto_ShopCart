import { LARGO_MAXIMO_TEXTO_BUSQUEDA, type ConsultaProductosAdmin } from '@shopcart/shared';
import { useId } from 'react';
import { CLASE_SELECT } from '../../../shared/componentes/CampoSeleccion';
import { FiltroTexto } from '../../../shared/componentes/FiltroTexto';
import type { ParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import type { CategoriaAdmin } from '../catalogo.api';

const ESTADOS = { '': 'Activos e inactivos', true: 'Activos', false: 'Inactivos' } as const;

const estadoDe = (activo: boolean | undefined) =>
  activo === undefined ? '' : activo ? 'true' : 'false';

interface PropsFiltros {
  parametros: ParametrosUrl<ConsultaProductosAdmin>;
  categorias: CategoriaAdmin[];
}

/** Figma 48:1169: buscar por nombre, la categoría (todas, también las inactivas) y el estado; todo en la URL. */
export function FiltrosProductosAdmin({ parametros, categorias }: PropsFiltros) {
  const idCategoria = useId();
  const idEstado = useId();
  const { valores, cambiar } = parametros;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_12rem_14rem]">
      <FiltroTexto
        parametros={parametros}
        campo="texto"
        etiqueta="Buscar"
        placeholder="Nombre del producto"
        maxLength={LARGO_MAXIMO_TEXTO_BUSQUEDA}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idCategoria} className="control-etiqueta">
          Categoría
        </label>
        <select
          id={idCategoria}
          value={valores.categoria ?? ''}
          onChange={(evento) => {
            const valor = evento.target.value;
            cambiar({ categoria: valor === '' ? undefined : Number(valor) });
          }}
          className={CLASE_SELECT}
        >
          <option value="">Todas</option>
          {categorias.map((categoria) => (
            <option key={categoria.idCategoria} value={categoria.idCategoria}>
              {categoria.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={idEstado} className="control-etiqueta">
          Estado
        </label>
        <select
          id={idEstado}
          value={estadoDe(valores.activo)}
          onChange={(evento) => {
            const valor = evento.target.value;
            cambiar({ activo: valor === '' ? undefined : valor === 'true' });
          }}
          className={CLASE_SELECT}
        >
          {Object.entries(ESTADOS).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
