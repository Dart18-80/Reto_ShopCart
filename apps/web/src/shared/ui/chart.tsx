import type { ComponentProps, CSSProperties } from 'react';
import { ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from './cn';

/**
 * El `Chart` de shadcn/ui (FE-07), reducido a lo que usa el dashboard: el contenedor que da a Recharts las clases
 * del tema y un color por serie. Cada serie queda como variable CSS (`--color-<serie>`), así las marcas se pintan con
 * `var(--color-ventas)` y el modo oscuro sale de los tokens (`--chart-1`, `--chart-negativo`).
 */
export type ChartConfig = Record<string, { color: string }>;

// Las clases con las que shadcn adapta las piezas internas de Recharts a los tokens del tema.
const CLASES_RECHARTS =
  "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-layer]:outline-hidden [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-surface]:outline-hidden";

// Antes de medir su contenedor, ResponsiveContainer dibuja con este tamaño (también en las pruebas, sin diseño).
const DIMENSION_INICIAL = { width: 320, height: 200 } as const;

const variablesDe = (config: ChartConfig): CSSProperties =>
  Object.fromEntries(
    Object.entries(config).map(([serie, { color }]) => [`--color-${serie}`, color]),
  );

function ChartContainer({
  config,
  className,
  style,
  children,
  ...props
}: Omit<ComponentProps<'div'>, 'children'> & {
  config: ChartConfig;
  children: ComponentProps<typeof ResponsiveContainer>['children'];
}) {
  return (
    <div
      data-slot="chart"
      className={cn(CLASES_RECHARTS, className)}
      style={{ ...variablesDe(config), ...style }}
      {...props}
    >
      <ResponsiveContainer initialDimension={DIMENSION_INICIAL}>{children}</ResponsiveContainer>
    </div>
  );
}

const ChartTooltip = Tooltip;

/** El recuadro del tooltip con el estilo de shadcn; el contenido lo pone cada gráfica. */
function ChartTooltipContent({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
        className,
      )}
      {...props}
    />
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent };
