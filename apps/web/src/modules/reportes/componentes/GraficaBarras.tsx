import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ReferenceLine,
  XAxis,
  YAxis,
  type BarShapeProps,
  type YAxisTickContentProps,
  type TooltipContentProps,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../../shared/ui/chart';
import {
  formatearEscala,
  TEXTO_NETO_CON_DEVOLUCIONES,
  type Escala,
  type PuntoGrafica,
} from '../graficas';

/** `columnas`: un periodo por columna (ventas). `barras`: barras horizontales con nombres largos (05 §11). */
export type Orientacion = 'columnas' | 'barras';

const CONFIG = {
  valor: { color: 'var(--chart-1)' },
  negativo: { color: 'var(--chart-negativo)' },
} satisfies ChartConfig;

const ALTO_POR_BARRA = 36;
const MARGEN_DEL_EJE = 40;
// D6: el eje de los nombres mide lo que pide el nombre más largo, hasta un máximo; cada nombre va en una línea.
const ANCHO_MAXIMO_DE_LOS_NOMBRES = 200;
const PX_POR_CARACTER = 7;
const AIRE_DEL_NOMBRE = 12;
// D6: las barras con las esquinas del extremo redondeadas (4 px).
const RADIO_COLUMNA: [number, number, number, number] = [4, 4, 0, 0];
const RADIO_BARRA: [number, number, number, number] = [0, 4, 4, 0];

// 05 §11: el eje siempre incluye el cero, también cuando todo es negativo o todo es positivo.
const dominioConCero = ([minimo, maximo]: readonly [number, number]): [number, number] => [
  Math.min(0, minimo),
  Math.max(0, maximo),
];

const anchoDeLosNombres = (puntos: readonly PuntoGrafica[]) =>
  Math.min(
    ANCHO_MAXIMO_DE_LOS_NOMBRES,
    Math.max(0, ...puntos.map((p) => p.etiqueta.length)) * PX_POR_CARACTER + AIRE_DEL_NOMBRE,
  );

// El nombre completo está en el tooltip y en la tabla; el eje solo tiene espacio para el principio.
const acortar = (nombre: string, caben: number) =>
  nombre.length > caben ? `${nombre.slice(0, Math.max(1, caben - 1))}…` : nombre;

/** Un nombre del eje en una sola línea, con elipsis si no cabe (Recharts lo partiría en dos). */
function NombreDelEje({
  x,
  y,
  nombre,
  caben,
}: {
  x: number;
  y: number;
  nombre: string;
  caben: number;
}) {
  return (
    <text
      x={x}
      y={y}
      dx={-6}
      dy="0.32em"
      textAnchor="end"
      className="fill-muted-foreground text-xs"
    >
      {acortar(nombre, caben)}
    </text>
  );
}

function Tooltip({ punto }: { punto: PuntoGrafica }) {
  return (
    <ChartTooltipContent>
      <p className="font-medium">{punto.titulo}</p>
      <p className="tabular-nums">{punto.detalle}</p>
      {punto.negativo && <p className="text-chart-negativo">{TEXTO_NETO_CON_DEVOLUCIONES}</p>}
    </ChartTooltipContent>
  );
}

/** N-11: los periodos o los nombres con ventas negativas se dicen con texto, no solo con el tono de su barra. */
function Negativos({ puntos }: { puntos: readonly PuntoGrafica[] }) {
  const negativos = puntos.filter((p) => p.negativo);
  if (negativos.length === 0) return null;
  return (
    <p className="texto-nota text-muted-foreground flex items-start gap-2">
      <span
        aria-hidden
        className="bg-chart-negativo mt-1 inline-block size-2.5 shrink-0 rounded-sm"
      />
      <span>
        {TEXTO_NETO_CON_DEVOLUCIONES}: {negativos.map((p) => p.titulo).join(', ')}.
      </span>
    </p>
  );
}

/**
 * FE-07: una serie en barras con los colores del tema. Las negativas llevan `--chart-negativo` y se nombran debajo;
 * el tooltip muestra el texto del backend ya formateado, nunca el número de la geometría.
 */
export function GraficaBarras({
  puntos,
  orientacion,
  escala,
  descripcion,
}: {
  puntos: readonly PuntoGrafica[];
  orientacion: Orientacion;
  escala: Escala;
  /** El nombre accesible de la gráfica; la tabla tiene los mismos datos. */
  descripcion: string;
}) {
  const barra = ({ x, y, width, height, index }: BarShapeProps) => (
    <Rectangle
      x={x}
      y={y}
      width={width}
      height={height}
      radius={orientacion === 'columnas' ? RADIO_COLUMNA : RADIO_BARRA}
      fill={puntos[index]?.negativo ? 'var(--color-negativo)' : 'var(--color-valor)'}
    />
  );
  // Recharts da el índice del dato activo como texto.
  const tooltip = ({ active, activeIndex }: TooltipContentProps) => {
    const punto = active && activeIndex != null ? puntos[Number(activeIndex)] : undefined;
    return punto ? <Tooltip punto={punto} /> : null;
  };
  const escalar = (valor: number) => formatearEscala(valor, escala);
  const hayNegativos = puntos.some((p) => p.negativo);
  const anchoNombres = anchoDeLosNombres(puntos);
  const caben = Math.floor((anchoNombres - AIRE_DEL_NOMBRE) / PX_POR_CARACTER);

  return (
    <figure aria-label={descripcion} className="flex flex-col gap-3">
      {orientacion === 'columnas' ? (
        <ChartContainer config={CONFIG} className="aspect-auto h-64 w-full">
          {/* D6: un margen a la izquierda para que el eje no recorte la «Q» de los montos. */}
          <BarChart data={[...puntos]} margin={{ left: 8 }} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              domain={dominioConCero}
              tickFormatter={escalar}
              tickLine={false}
              axisLine={false}
              width="auto"
            />
            {hayNegativos && <ReferenceLine y={0} stroke="var(--border)" />}
            <ChartTooltip cursor content={tooltip} />
            <Bar dataKey="valor" shape={barra} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      ) : (
        // Con muchas categorías la gráfica crece: se desplaza dentro de su panel (los navegadores actuales dejan
        // enfocar un contenedor desplazable con el teclado; la tabla tiene los mismos datos).
        <div className="max-h-[30rem] overflow-y-auto">
          <ChartContainer
            config={CONFIG}
            className="aspect-auto w-full"
            style={{ height: puntos.length * ALTO_POR_BARRA + MARGEN_DEL_EJE }}
          >
            <BarChart data={[...puntos]} layout="vertical" accessibilityLayer>
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                domain={dominioConCero}
                tickFormatter={escalar}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="etiqueta"
                tick={({ x, y, index }: YAxisTickContentProps) => (
                  <NombreDelEje
                    x={Number(x)}
                    y={Number(y)}
                    nombre={puntos[index]?.etiqueta ?? ''}
                    caben={caben}
                  />
                )}
                tickLine={false}
                axisLine={false}
                width={anchoNombres}
              />
              {hayNegativos && <ReferenceLine x={0} stroke="var(--border)" />}
              <ChartTooltip cursor content={tooltip} />
              <Bar dataKey="valor" shape={barra} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
      <Negativos puntos={puntos} />
    </figure>
  );
}
