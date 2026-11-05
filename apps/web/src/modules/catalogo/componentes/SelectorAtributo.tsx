import { MuestraColor } from '../../../shared/componentes/prenda/MuestraColor';
import { cn } from '../../../shared/ui/cn';
import type { AtributoDelProducto, EstadoOpcion, ValorDelAtributo } from '../seleccionVariante';

// FE-16: el atributo llamado Color es el color de la prenda: se elige con muestras.
export const ATRIBUTO_COLOR = 'Color';

export interface OpcionConEstado extends ValorDelAtributo {
  estado: EstadoOpcion;
}

interface PropsSelectorAtributo {
  atributo: AtributoDelProducto;
  opciones: OpcionConEstado[];
  elegido: number | undefined;
  /** Los valores elegidos en los demás atributos, para explicar por qué una opción no está («en Azul»). */
  enLoElegido: string[];
  onElegir: (idValorAtributo: number) => void;
}

const notaDe = (
  opcion: OpcionConEstado,
  esColor: boolean,
  enLoElegido: string[],
): string | null => {
  if (opcion.estado === 'disponible') return null;
  const en = enLoElegido.length > 0 ? ` en ${enLoElegido.join(' y ')}` : '';
  if (opcion.estado === 'inexistente') return `${opcion.valor} no disponible${en}`;
  return `${opcion.valor} ${esColor ? 'agotado' : 'agotada'}${en}`;
};

const BOTON_TEXTO =
  'texto-pequeno-fuerte focus-visible:ring-ring min-w-13 rounded-md border px-4 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:bg-muted disabled:text-muted-foreground disabled:line-through disabled:cursor-not-allowed';

/**
 * Figma 24:314: un grupo por atributo. Una opción que no forma ninguna variante disponible con lo ya elegido se
 * deshabilita y se explica a un lado («XL agotada en Azul»). La existencia la decide el backend.
 */
export function SelectorAtributo({
  atributo,
  opciones,
  elegido,
  enLoElegido,
  onElegir,
}: PropsSelectorAtributo) {
  const esColor = atributo.nombre === ATRIBUTO_COLOR;
  const valorElegido = opciones.find((o) => o.idValorAtributo === elegido)?.valor;
  const notas = opciones
    .map((opcion) => notaDe(opcion, esColor, enLoElegido))
    .filter((nota) => nota !== null);

  return (
    <div role="group" aria-label={atributo.nombre} className="flex flex-col gap-2">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="texto-pequeno-fuerte">
          {esColor && valorElegido !== undefined
            ? `${atributo.nombre}: ${valorElegido}`
            : atributo.nombre}
        </span>
        {notas.length > 0 && (
          <span className="texto-nota text-muted-foreground">{notas.join(' · ')}</span>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {opciones.map((opcion) => {
          const activo = opcion.idValorAtributo === elegido;
          const deshabilitada = opcion.estado !== 'disponible';
          return esColor ? (
            <button
              key={opcion.idValorAtributo}
              type="button"
              aria-label={opcion.valor}
              aria-pressed={activo}
              disabled={deshabilitada}
              onClick={() => {
                onElegir(opcion.idValorAtributo);
              }}
              className="focus-visible:ring-ring rounded-full focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MuestraColor color={opcion.valor} seleccionada={activo} className="size-10" />
            </button>
          ) : (
            <button
              key={opcion.idValorAtributo}
              type="button"
              aria-pressed={activo}
              disabled={deshabilitada}
              onClick={() => {
                onElegir(opcion.idValorAtributo);
              }}
              className={cn(
                BOTON_TEXTO,
                activo
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card hover:border-primary',
              )}
            >
              {opcion.valor}
            </button>
          );
        })}
      </div>
    </div>
  );
}
