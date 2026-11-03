import { Link } from 'react-router';
import { useSesion } from '../../shared/hooks/useSesion';
import { menuDe } from '../rutas';
import { SelectorTema } from '../tema/SelectorTema';
import { BotonCerrarSesion } from './BotonCerrarSesion';
import { NavegacionArea } from './NavegacionArea';

export const NOMBRE_MENU_BACKOFFICE = 'Backoffice';

/**
 * Figma: Barra lateral backoffice (20:271). Marca, menú por grupos y el usuario con su rol. El selector de tema no
 * está en el frame: va junto a la marca para no cortar el nombre del usuario.
 */
export function BarraLateralBackoffice({ onNavegar }: { onNavegar?: () => void }) {
  const { estado, usuario } = useSesion();

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex items-start justify-between gap-2">
        <Link to="/" onClick={onNavegar} className="flex flex-col gap-0.5">
          <span className="display-titulo-3 text-primary">ShopCart</span>
          <span className="texto-nota text-muted-foreground">Backoffice</span>
        </Link>
        <SelectorTema />
      </div>
      <NavegacionArea
        nombre={NOMBRE_MENU_BACKOFFICE}
        entradas={menuDe('backoffice', estado)}
        onNavegar={onNavegar}
      />
      {usuario && (
        <div className="mt-auto flex items-center gap-3">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="texto-pequeno-fuerte truncate">{usuario.nombre}</span>
            <span className="texto-nota text-muted-foreground">{usuario.rol}</span>
          </div>
          <BotonCerrarSesion variante="icono" />
        </div>
      )}
    </div>
  );
}
