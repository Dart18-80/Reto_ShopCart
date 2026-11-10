import type { CSSProperties, SVGProps } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ReferenceLine,
  LabelList,
  useActiveTooltipDataPoints,
  usePlotArea,
  XAxis,
  YAxis,
  type BarShapeProps,
  type YAxisTickContentProps,
  type TooltipContentProps,
} from 'recharts';
import { useEntradaInicial } from '../../../shared/hooks/useEntradaInicial';
import { cn } from '../../../shared/ui/cn';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../../shared/ui/chart';
import { usePantallaAncha } from '../../../shared/hooks/usePantallaAncha';
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
const ANCHO_MAXIMO_EN_TELEFONO = 112;
const PX_POR_CARACTER = 7;
const AIRE_DEL_NOMBRE = 12;
// Las barras con las esquinas del extremo redondeadas (6 px): arriba en columnas, al final en horizontal.
const RADIO_COLUMNA: [number, number, number, number] = [6, 6, 0, 0];
const RADIO_BARRA: [number, number, number, number] = [0, 6, 6, 0];

// La cifra sobre cada barra: solo si cabe. En columnas, con más de 8 o si la columna es más angosta que la cifra más
// larga, se ocultan todas (el tooltip y la tabla siguen teniendo los montos).
const MAXIMO_DE_COLUMNAS_CON_CIFRA = 8;
const SEPARACION_DE_LA_CIFRA = 6;
const ESPACIO_PARA_LAS_CIFRAS = 20;

const anchoDeLaCifra = (puntos: readonly PuntoGrafica[]) =>
  Math.max(0, ...puntos.map((p) => p.cifra.length)) * PX_POR_CARACTER;

const cabenLasCifrasEnColumnas = (puntos: readonly PuntoGrafica[], anchoDelArea: number) =>
  puntos.length <= MAXIMO_DE_COLUMNAS_CON_CIFRA &&
  anchoDelArea / puntos.length >= anchoDeLaCifra(puntos);

interface CajaDeBarra {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * El monto o el conteo de una barra, tal como lo armó graficas.ts del texto del backend (FE-10): encima de la
 * columna (debajo en las negativas) o al final de la barra horizontal. Aparece con un fundido después de su barra.
 */
function CifraDeBarra({
  puntos,
  orientacion,
  viewBox,
  index,
}: {
  puntos: readonly PuntoGrafica[];
  orientacion: Orientacion;
  viewBox?: CajaDeBarra | object;
  index?: number;
}) {
  const area = usePlotArea();
  const punto = index === undefined ? undefined : puntos[index];
  if (!punto || !area || !viewBox || !('width' in viewBox)) return null;
  if (orientacion === 'columnas' && !cabenLasCifrasEnColumnas(puntos, area.width)) return null;
  const { x = 0, y = 0, width = 0, height = 0 } = viewBox;
  const [arriba, abajo] = [Math.min(y, y + height), Math.max(y, y + height)];
  const [izquierda, derecha] = [Math.min(x, x + width), Math.max(x, x + width)];
  const posicion: SVGProps<SVGTextElement> =
    orientacion === 'columnas'
      ? {
          x: x + width / 2,
          y: punto.negativo ? abajo + SEPARACION_DE_LA_CIFRA : arriba - SEPARACION_DE_LA_CIFRA,
          textAnchor: 'middle',
          dominantBaseline: punto.negativo ? 'hanging' : 'auto',
        }
      : {
          x: punto.negativo ? izquierda - SEPARACION_DE_LA_CIFRA : derecha + SEPARACION_DE_LA_CIFRA,
          y: y + height / 2,
          textAnchor: punto.negativo ? 'end' : 'start',
          dominantBaseline: 'central',
        };
  return (
    <text
      {...posicion}
      className="etiqueta-barra fill-foreground text-xs font-semibold tabular-nums"
      style={{ '--i': index } as CSSProperties}
    >
      {punto.cifra}
    </text>
  );
}

// Hacia dónde crece cada barra desde el cero (su origen al crecer, en movimiento.css).
type Direccion = 'arriba' | 'abajo' | 'derecha' | 'izquierda';
const DIRECCION: Record<Orientacion, { positiva: Direccion; negativa: Direccion }> = {
  columnas: { positiva: 'arriba', negativa: 'abajo' },
  barras: { positiva: 'derecha', negativa: 'izquierda' },
};

/**
 * La forma de cada barra. Con una barra activa (la del tooltip, por cursor o teclado), las demás quedan al 45 %: el
 * punto activo sale de Recharts, no del :hover del SVG. `--i` escalona su crecimiento al montar.
 */
function BarraGrafica({
  forma,
  punto,
  orientacion,
}: {
  forma: BarShapeProps;
  punto: PuntoGrafica | undefined;
  orientacion: Orientacion;
}) {
  const [activo] = useActiveTooltipDataPoints<PuntoGrafica>() ?? [];
  const estado =
    activo === undefined ? undefined : activo.clave === punto?.clave ? 'activa' : 'atenuada';
  const direccion = DIRECCION[orientacion][punto?.negativo ? 'negativa' : 'positiva'];
  return (
    <Rectangle
      x={forma.x}
      y={forma.y}
      width={forma.width}
      height={forma.height}
      radius={orientacion === 'columnas' ? RADIO_COLUMNA : RADIO_BARRA}
      fill={punto?.negativo ? 'var(--color-negativo)' : 'var(--color-valor)'}
      className="barra-grafica"
      data-direccion={direccion}
      data-estado={estado}
      style={{ '--i': forma.index } as CSSProperties}
    />
  );
}

// 05 §11: el eje siempre incluye el cero, también cuando todo es negativo o todo es positivo.
const dominioConCero = ([minimo, maximo]: readonly [number, number]): [number, number] => [
  Math.min(0, minimo),
  Math.max(0, maximo),
];

const anchoDeLosNombres = (puntos: readonly PuntoGrafica[], maximo: number) =>
  Math.min(
    maximo,
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
  const barra = (forma: BarShapeProps) => (
    <BarraGrafica forma={forma} punto={puntos[forma.index]} orientacion={orientacion} />
  );
  // Las barras crecen solo al montar la gráfica; si cambian los periodos o los nombres, aparecen sin animar.
  const creciendo = useEntradaInicial(puntos.map((p) => p.clave).join('|'));
  // Recharts da el índice del dato activo como texto.
  const tooltip = ({ active, activeIndex }: TooltipContentProps) => {
    const punto = active && activeIndex != null ? puntos[Number(activeIndex)] : undefined;
    return punto ? <Tooltip punto={punto} /> : null;
  };
  const escalar = (valor: number) => formatearEscala(valor, escala);
  const hayNegativos = puntos.some((p) => p.negativo);
  const pantallaAncha = usePantallaAncha();
  const anchoNombres = anchoDeLosNombres(
    puntos,
    pantallaAncha ? ANCHO_MAXIMO_DE_LOS_NOMBRES : ANCHO_MAXIMO_EN_TELEFONO,
  );
  const caben = Math.floor((anchoNombres - AIRE_DEL_NOMBRE) / PX_POR_CARACTER);

  return (
    <figure
      aria-label={descripcion}
      className={cn('flex flex-col gap-3', creciendo && 'barras-creciendo')}
    >
      {orientacion === 'columnas' ? (
        <ChartContainer config={CONFIG} className="aspect-auto h-64 w-full">
          {/* D6: un margen a la izquierda para que el eje no recorte la «Q» de los montos. */}
          <BarChart
            data={[...puntos]}
            margin={{
              left: 8,
              top:
                puntos.length <= MAXIMO_DE_COLUMNAS_CON_CIFRA ? ESPACIO_PARA_LAS_CIFRAS : undefined,
            }}
            accessibilityLayer
          >
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
            <Bar dataKey="valor" shape={barra} isAnimationActive={false}>
              <LabelList
                dataKey="cifra"
                content={<CifraDeBarra puntos={puntos} orientacion="columnas" />}
              />
            </Bar>
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
            <BarChart
              data={[...puntos]}
              layout="vertical"
              // El espacio a la derecha para la cifra al final de la barra más larga.
              margin={{ right: anchoDeLaCifra(puntos) + SEPARACION_DE_LA_CIFRA }}
              accessibilityLayer
            >
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
              <Bar dataKey="valor" shape={barra} isAnimationActive={false}>
                <LabelList
                  dataKey="cifra"
                  content={<CifraDeBarra puntos={puntos} orientacion="barras" />}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      )}
      <Negativos puntos={puntos} />
    </figure>
  );
}
