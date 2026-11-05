import type { ConsultaBusqueda } from '@shopcart/shared';
import { ChevronDown } from 'lucide-react';

type Orden = Pick<ConsultaBusqueda, 'orden' | 'direccion'>;

// La lista blanca del backend (ORDENES_BUSQUEDA) con la dirección de cada opción de la tienda. Relevancia y
// recientes no usan la dirección.
const OPCIONES = {
  relevancia: { etiqueta: 'Relevancia', orden: { orden: 'relevancia', direccion: 'asc' } },
  'precio-asc': {
    etiqueta: 'Precio: de menor a mayor',
    orden: { orden: 'precio', direccion: 'asc' },
  },
  'precio-desc': {
    etiqueta: 'Precio: de mayor a menor',
    orden: { orden: 'precio', direccion: 'desc' },
  },
  nombre: { etiqueta: 'Nombre', orden: { orden: 'nombre', direccion: 'asc' } },
  recientes: { etiqueta: 'Más recientes', orden: { orden: 'recientes', direccion: 'asc' } },
} as const satisfies Record<string, { etiqueta: string; orden: Orden }>;
type ClaveOpcion = keyof typeof OPCIONES;

const esClave = (valor: string): valor is ClaveOpcion => valor in OPCIONES;

function claveDe({ orden, direccion }: Orden): ClaveOpcion {
  if (orden === 'precio') return direccion === 'desc' ? 'precio-desc' : 'precio-asc';
  // nombre descendente no tiene opción en la tienda: se muestra como Nombre.
  return orden;
}

interface PropsSelectorOrden {
  valor: Orden;
  onCambiar: (orden: Orden) => void;
}

/** Figma: Selector (22:85). Un `select` nativo: accesible con teclado y lector de pantalla sin más. */
export function SelectorOrden({ valor, onCambiar }: PropsSelectorOrden) {
  return (
    <div className="relative">
      <select
        aria-label="Ordenar"
        value={claveDe(valor)}
        onChange={(evento) => {
          const clave = evento.target.value;
          if (esClave(clave)) onCambiar(OPCIONES[clave].orden);
        }}
        className="bg-card texto-base focus-visible:ring-ring h-10.5 w-full appearance-none rounded-md border py-2 pr-9 pl-3 focus-visible:ring-2 focus-visible:outline-none"
      >
        {Object.entries(OPCIONES).map(([clave, { etiqueta }]) => (
          <option key={clave} value={clave}>
            {etiqueta}
          </option>
        ))}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
      />
    </div>
  );
}
