import { SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../shared/ui/button';
import { AvisoDePagina } from '../../shared/componentes/AvisoDePagina';

export function NoEncontrado() {
  return (
    <AvisoDePagina
      icono={SearchX}
      titulo="No encontramos esta página"
      acciones={
        <Button asChild>
          <Link to="/">Ir a la tienda</Link>
        </Button>
      }
    >
      Puede que el enlace esté mal escrito o que la página ya no exista.
    </AvisoDePagina>
  );
}
