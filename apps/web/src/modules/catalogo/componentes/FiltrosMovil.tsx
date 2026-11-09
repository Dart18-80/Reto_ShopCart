import type { ConsultaBusqueda } from '@shopcart/shared';
import { Button } from '../../../shared/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '../../../shared/ui/sheet';
import { FiltrosCatalogo } from './FiltrosCatalogo';

// Los filtros que viven en el panel; la categoría está en los chips y el texto, en el buscador del encabezado.
const CAMPOS_DEL_PANEL = ['precioMin', 'precioMax', 'disponible'] as const;

interface PropsFiltrosMovil {
  valores: ConsultaBusqueda;
  onCambiar: (cambios: Partial<ConsultaBusqueda>) => void;
  onLimpiar: () => void;
}

/** Figma 23:516: en móvil los filtros se abren desde «Filtros (n)», con n los activos del panel. */
export function FiltrosMovil(props: PropsFiltrosMovil) {
  const activos = CAMPOS_DEL_PANEL.filter((campo) => props.valores[campo] !== undefined).length;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="md:hidden">
          {`Filtros (${String(activos)})`}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-5 px-4 py-6">
        <SheetTitle className="titulo-2">Filtros</SheetTitle>
        <SheetDescription className="sr-only">Precio y existencia</SheetDescription>
        <FiltrosCatalogo {...props} />
      </SheetContent>
    </Sheet>
  );
}
