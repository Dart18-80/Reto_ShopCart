import { LayoutGrid, LogIn, LogOut, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useCerrarSesion } from '../../shared/hooks/useCerrarSesion';
import { useSesion } from '../../shared/hooks/useSesion';
import { Button } from '../../shared/ui/button';
import { permisoPara } from '../acceso';
import { rutaDeIngreso } from '../Guardian';
import { ACCESO_DE_AREA, RAIZ_DE_AREA } from '../rutas';

/** Ingresar, o la cuenta, el backoffice (personal) y cerrar sesión. */
export function AccesoCuenta() {
  const { estado, usuario } = useSesion();
  const cerrarSesion = useCerrarSesion();
  const { pathname, search } = useLocation();

  if (!usuario) {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link to={rutaDeIngreso(`${pathname}${search}`)}>
          <LogIn aria-hidden />
          Ingresar
        </Link>
      </Button>
    );
  }

  const veBackoffice = permisoPara(ACCESO_DE_AREA.backoffice, estado) === 'permitido';
  return (
    <div className="flex items-center gap-1">
      {veBackoffice && (
        <Button variant="ghost" size="sm" asChild>
          <Link to={RAIZ_DE_AREA.backoffice}>
            <LayoutGrid aria-hidden />
            Backoffice
          </Link>
        </Button>
      )}
      <Button variant="ghost" size="sm" asChild>
        <Link to={RAIZ_DE_AREA.cuenta} aria-label={`Mi cuenta (${usuario.nombre})`}>
          <UserRound aria-hidden />
          <span className="hidden sm:inline">{usuario.nombre}</span>
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Cerrar sesión"
        disabled={cerrarSesion.isPending}
        onClick={() => {
          cerrarSesion.mutate();
        }}
      >
        <LogOut aria-hidden />
      </Button>
    </div>
  );
}
