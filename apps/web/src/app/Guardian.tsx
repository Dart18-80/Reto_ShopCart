import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { CargandoPagina } from '../shared/componentes/CargandoPagina';
import { useSesion } from '../shared/hooks/useSesion';
import { permisoPara, type Acceso } from './acceso';
import { SesionSinVerificar } from './paginas/SesionSinVerificar';
import { SinPermiso } from './paginas/SinPermiso';
import { RUTAS } from '../shared/rutas';

/** `/ingresar?volver=<ruta>`: al entrar, el login regresa a la ruta que se pedía. */
export const rutaDeIngreso = (volver: string) =>
  `${RUTAS.ingresar}?${new URLSearchParams({ volver }).toString()}`;

/** FE-04: experiencia de usuario, no seguridad; el backend responde 401 o 403 de todos modos (RF-01). */
export function Guardian({ acceso, children }: { acceso: Acceso; children: ReactNode }) {
  const { estado, errorDeVerificacion, reintentarVerificacion } = useSesion();
  const { pathname, search } = useLocation();

  switch (permisoPara(acceso, estado)) {
    case 'permitido':
      return children;
    case 'verificando':
      return <CargandoPagina mensaje="Verificando tu sesión…" />;
    case 'sinVerificar':
      return (
        <SesionSinVerificar error={errorDeVerificacion} onReintentar={reintentarVerificacion} />
      );
    case 'ingresar':
      return <Navigate to={rutaDeIngreso(`${pathname}${search}`)} replace />;
    case 'sinPermiso':
      return <SinPermiso />;
  }
}
