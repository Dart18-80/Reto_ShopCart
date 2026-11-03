import { Navigate } from 'react-router';
import { useSesion } from '../../shared/hooks/useSesion';
import { menuDe, type Area } from '../rutas';
import { NoEncontrado } from './NoEncontrado';

/** `/cuenta` y `/backoffice` llevan a la primera página del menú que el rol puede abrir. */
export function InicioDeArea({ area }: { area: Area }) {
  const { estado } = useSesion();
  const [primera] = menuDe(area, estado);
  if (!primera) return <NoEncontrado />;
  return <Navigate to={primera.ruta} replace />;
}
