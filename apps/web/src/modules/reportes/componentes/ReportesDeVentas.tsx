import { AGRUPACIONES, type Agrupacion, type RangoDeFechas } from '@shopcart/shared';
import { useId } from 'react';
import { CLASE_SELECT } from '../../../shared/ui/control';
import { formatearCantidad } from '../../../shared/formato/conteo';
import { DialogoExportar } from '../../exportaciones';
import type { ParametrosUrl } from '../../../shared/hooks/useParametrosUrl';
import {
  consultaVentasDe,
  METRICAS_VENTAS,
  type ConsultaDashboard,
  type MetricaVentas,
} from '../consultaDashboard';
import { puntosDeCategorias, puntosDeTop, puntosDeVentas, tituloDelPeriodo } from '../graficas';
import { useTopProductos, useVentas, useVentasPorCategoria } from '../hooks/useReportes';
import type { ProductoVendido, VentasDeCategoria, VentasDelPeriodo } from '../reportes.api';
import { GraficaBarras } from './GraficaBarras';
import { MontoNeto } from './MontoNeto';
import { PanelReporte } from './PanelReporte';
import { TablaDeGrafica, type ColumnaDeGrafica } from './TablaDeGrafica';

const SIN_VENTAS = {
  titulo: 'Sin ventas en este periodo',
  descripcion: 'Prueba con otro rango de fechas.',
};

const NOMBRE_AGRUPACION: Record<Agrupacion, string> = { dia: 'Día', semana: 'Semana', mes: 'Mes' };
const NOMBRE_METRICA: Record<MetricaVentas, string> = {
  quetzales: 'Quetzales',
  pedidos: 'Pedidos',
};

function Selector<V extends string>({
  etiqueta,
  valor,
  opciones,
  nombres,
  alCambiar,
}: {
  etiqueta: string;
  valor: V;
  opciones: readonly V[];
  nombres: Record<V, string>;
  alCambiar: (valor: V) => void;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="control-etiqueta">
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(evento) => {
          const elegida = opciones.find((opcion) => opcion === evento.target.value);
          if (elegida) alCambiar(elegida);
        }}
        className={CLASE_SELECT}
      >
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {nombres[opcion]}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Ventas por día, semana o mes en columnas, en quetzales o en pedidos (05 §11: sin doble eje). La agrupación y la
 * métrica van en la URL; cambiarlas no mueve la página de los carritos abandonados.
 */
export function ReporteVentasPorPeriodo({
  parametros,
}: {
  parametros: ParametrosUrl<ConsultaDashboard>;
}) {
  const { valores, cambiar } = parametros;
  const consulta = consultaVentasDe(valores);
  const ventas = useVentas(consulta);
  const { agrupacion, metrica } = valores;
  const columnas: readonly ColumnaDeGrafica<VentasDelPeriodo>[] = [
    { etiqueta: 'Periodo', celda: (fila) => tituloDelPeriodo(fila.periodo, agrupacion) },
    { etiqueta: 'Ventas', cifra: true, celda: (fila) => <MontoNeto valor={fila.ventas} /> },
    { etiqueta: 'Pedidos', cifra: true, celda: (fila) => formatearCantidad(fila.pedidos) },
  ];

  return (
    <PanelReporte
      titulo="Ventas por periodo"
      descripcion="Productos con IVA, sin envío y menos las devoluciones de cada periodo."
      consulta={ventas}
      vacio={SIN_VENTAS}
      exportar={<DialogoExportar reporte="ventas" filtros={consulta} />}
      controles={
        <div className="grid gap-4 sm:grid-cols-2 md:max-w-md">
          <Selector
            etiqueta="Agrupar por"
            valor={agrupacion}
            opciones={AGRUPACIONES}
            nombres={NOMBRE_AGRUPACION}
            alCambiar={(siguiente) => {
              cambiar({ agrupacion: siguiente, pagina: valores.pagina });
            }}
          />
          <Selector
            etiqueta="Mostrar"
            valor={metrica}
            opciones={METRICAS_VENTAS}
            nombres={NOMBRE_METRICA}
            alCambiar={(siguiente) => {
              cambiar({ metrica: siguiente, pagina: valores.pagina });
            }}
          />
        </div>
      }
      grafica={(filas) => (
        <GraficaBarras
          puntos={puntosDeVentas(filas, agrupacion, metrica)}
          orientacion="columnas"
          escala={metrica === 'quetzales' ? 'quetzales' : 'conteo'}
          descripcion={`Ventas por ${NOMBRE_AGRUPACION[agrupacion].toLowerCase()} en ${NOMBRE_METRICA[metrica].toLowerCase()}`}
        />
      )}
      tabla={(filas) => (
        <TablaDeGrafica
          titulo="Ventas por periodo"
          columnas={columnas}
          filas={filas}
          claveFila={(fila) => fila.periodo}
        />
      )}
    />
  );
}

const COLUMNAS_CATEGORIAS: readonly ColumnaDeGrafica<VentasDeCategoria>[] = [
  { etiqueta: 'Categoría', celda: (fila) => fila.categoria },
  { etiqueta: 'Ventas', cifra: true, celda: (fila) => <MontoNeto valor={fila.ventas} /> },
  { etiqueta: 'Unidades', cifra: true, celda: (fila) => formatearCantidad(fila.unidades) },
];

/** Ventas por categoría en barras horizontales, de mayor a menor como las ordena el backend. */
export function ReporteVentasPorCategoria({ rango }: { rango: RangoDeFechas }) {
  const categorias = useVentasPorCategoria(rango);
  return (
    <PanelReporte
      titulo="Ventas por categoría"
      consulta={categorias}
      vacio={SIN_VENTAS}
      exportar={<DialogoExportar reporte="ventas-por-categoria" filtros={rango} />}
      grafica={(filas) => (
        <GraficaBarras
          puntos={puntosDeCategorias(filas)}
          orientacion="barras"
          escala="quetzales"
          descripcion="Ventas por categoría en quetzales"
        />
      )}
      tabla={(filas) => (
        <TablaDeGrafica
          titulo="Ventas por categoría"
          columnas={COLUMNAS_CATEGORIAS}
          filas={filas}
          claveFila={(fila) => fila.idCategoria}
        />
      )}
    />
  );
}

const COLUMNAS_TOP: readonly ColumnaDeGrafica<ProductoVendido>[] = [
  { etiqueta: 'Producto', celda: (fila) => fila.producto },
  { etiqueta: 'Unidades', cifra: true, celda: (fila) => formatearCantidad(fila.unidades) },
  { etiqueta: 'Ventas', cifra: true, celda: (fila) => <MontoNeto valor={fila.ventas} /> },
];

/** Los 10 productos más vendidos por unidades, en barras horizontales (nombres largos legibles). */
export function ReporteTopProductos({ rango }: { rango: RangoDeFechas }) {
  const top = useTopProductos(rango);
  return (
    <PanelReporte
      titulo="Top 10 productos"
      descripcion="Por unidades vendidas."
      consulta={top}
      vacio={SIN_VENTAS}
      exportar={<DialogoExportar reporte="top-productos" filtros={rango} />}
      grafica={(filas) => (
        <GraficaBarras
          puntos={puntosDeTop(filas)}
          orientacion="barras"
          escala="conteo"
          descripcion="Los 10 productos más vendidos por unidades"
        />
      )}
      tabla={(filas) => (
        <TablaDeGrafica
          titulo="Top 10 productos"
          columnas={COLUMNAS_TOP}
          filas={filas}
          claveFila={(fila) => fila.idProducto}
        />
      )}
    />
  );
}
