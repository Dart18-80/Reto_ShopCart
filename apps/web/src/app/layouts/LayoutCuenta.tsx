import { Outlet } from 'react-router';
import { useSesion } from '../../shared/hooks/useSesion';
import { menuDe } from '../rutas';
import { BotonCerrarSesion } from './BotonCerrarSesion';
import { EncabezadoTienda } from './EncabezadoTienda';
import { NavegacionArea } from './NavegacionArea';

/**
 * La cuenta comparte el encabezado de la tienda y agrega su menú, con el nombre y el correo de la sesión arriba
 * (M1-H02; sin frame en Figma todavía).
 */
export function LayoutCuenta() {
  const { estado, usuario } = useSesion();

  return (
    <div className="flex min-h-dvh flex-col">
      <EncabezadoTienda />
      <div className="flex w-full flex-1 flex-col gap-6 p-4 md:flex-row md:gap-8 md:p-8">
        <aside aria-label="Tu cuenta" className="flex flex-col gap-4 md:w-56 md:shrink-0">
          {usuario && (
            <div className="flex min-w-0 flex-col">
              <span className="texto-base-fuerte truncate">{usuario.nombre}</span>
              <span className="texto-pequeno text-muted-foreground truncate">{usuario.correo}</span>
            </div>
          )}
          <NavegacionArea nombre="Mi cuenta" entradas={menuDe('cuenta', estado)} />
          <div>
            <BotonCerrarSesion variante="texto" />
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col gap-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
