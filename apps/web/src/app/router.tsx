import { lazy, Suspense, type ReactNode } from 'react';
import type { RouteObject } from 'react-router';
import { CargandoPagina } from '../shared/componentes/CargandoPagina';
import { ACCESO_DE_AREA, PAGINAS, RAIZ_DE_AREA, type Area, type DefinicionPagina } from './rutas';
import { Guardian } from './Guardian';
import { LayoutTienda } from './layouts/LayoutTienda';
import { ErrorDeArea } from './paginas/ErrorDeArea';
import { InicioDeArea } from './paginas/InicioDeArea';
import { NoEncontrado } from './paginas/NoEncontrado';

// Los layouts de cuenta y backoffice se cargan dentro de su guardián: quien no entra al área no descarga su código.
const LayoutCuenta = lazy(async () => ({
  default: (await import('./layouts/LayoutCuenta')).LayoutCuenta,
}));
const LayoutBackoffice = lazy(async () => ({
  default: (await import('./layouts/LayoutBackoffice')).LayoutBackoffice,
}));

const diferido = (contenido: ReactNode) => (
  <Suspense fallback={<CargandoPagina />}>{contenido}</Suspense>
);

function rutaDePagina({ ruta, acceso, pagina: Pagina }: DefinicionPagina): RouteObject {
  return {
    path: ruta,
    // El acceso queda en `handle` para que una prueba compare cada menú con su ruta.
    handle: { acceso },
    element: <Guardian acceso={acceso}>{diferido(<Pagina />)}</Guardian>,
  };
}

const paginasDe = (area: Area) => PAGINAS.filter((p) => p.area === area).map(rutaDePagina);

const NO_ENCONTRADO: RouteObject = { path: '*', element: <NoEncontrado /> };

/** FE-04: tres áreas, cada una con su `errorElement`: si una pantalla falla, solo cae su área. */
export function crearRutas(): RouteObject[] {
  return [
    {
      element: <LayoutTienda />,
      errorElement: <ErrorDeArea area="tienda" />,
      children: [...paginasDe('tienda'), NO_ENCONTRADO],
    },
    {
      path: RAIZ_DE_AREA.cuenta,
      element: <Guardian acceso={ACCESO_DE_AREA.cuenta}>{diferido(<LayoutCuenta />)}</Guardian>,
      errorElement: <ErrorDeArea area="cuenta" />,
      children: [
        { index: true, element: <InicioDeArea area="cuenta" /> },
        ...paginasDe('cuenta'),
        NO_ENCONTRADO,
      ],
    },
    {
      path: RAIZ_DE_AREA.backoffice,
      element: (
        <Guardian acceso={ACCESO_DE_AREA.backoffice}>{diferido(<LayoutBackoffice />)}</Guardian>
      ),
      errorElement: <ErrorDeArea area="backoffice" />,
      children: [
        { index: true, element: <InicioDeArea area="backoffice" /> },
        ...paginasDe('backoffice'),
        NO_ENCONTRADO,
      ],
    },
  ];
}
