import { ShieldX } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../../shared/ui/button';
import { AvisoDePagina } from '../../shared/componentes/AvisoDePagina';

/** FE-04: con sesión pero sin el rol, el equivalente de un 403; no una redirección silenciosa. */
export function SinPermiso() {
  return (
    <AvisoDePagina
      icono={ShieldX}
      titulo="Sin permiso"
      acciones={
        <Button asChild>
          <Link to="/">Ir a la tienda</Link>
        </Button>
      }
    >
      Tu cuenta no tiene acceso a esta sección.
    </AvisoDePagina>
  );
}
