import { TriangleAlert } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../shared/ui/button';
import type { Area } from '../rutas';
import { AvisoDePagina } from '../../shared/componentes/AvisoDePagina';

const NOMBRE_DEL_AREA: Record<Area, string> = {
  tienda: 'la tienda',
  cuenta: 'tu cuenta',
  backoffice: 'el backoffice',
};

/** `errorElement` de cada área (FE-04): si una pantalla falla al renderizar, solo cae su área. */
export function ErrorDeArea({ area }: { area: Area }) {
  return (
    <AvisoDePagina
      icono={TriangleAlert}
      titulo={`Algo falló en ${NOMBRE_DEL_AREA[area]}`}
      acciones={
        <>
          <Button
            onClick={() => {
              window.location.reload();
            }}
          >
            Volver a cargar
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Ir a la tienda</Link>
          </Button>
        </>
      }
    >
      No pudimos mostrar esta pantalla. Vuelve a cargarla o sigue en la tienda.
    </AvisoDePagina>
  );
}
