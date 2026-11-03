import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, type RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Proveedores } from '../app/Proveedores';
import { crearQueryClient, sesion, type Rol } from '../shared/api';
import { sesionDePrueba } from './sesion';

interface OpcionesRenderizar {
  /** URL inicial del router en memoria. */
  ruta?: string;
  /** Monta una sesión simulada con un usuario de ese rol; sin rol, la prueba empieza como invitado. */
  rol?: Rol;
}

const TOKEN_DE_PRUEBA = 'token-de-prueba';

// El QueryClient de la aplicación con los reintentos apagados: un error se ve en el primer intento.
function crearQueryClientDePrueba() {
  const queryClient = crearQueryClient();
  const { queries } = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({ queries: { ...queries, retry: false } });
  return queryClient;
}

/**
 * Monta `rutas` en un router en memoria con los proveedores de la aplicación, un QueryClient nuevo sin
 * reintentos y, si se indica, la sesión con un rol. `configuracion.ts` olvida la sesión después de cada prueba.
 */
export function renderizarRutas(
  rutas: RouteObject[],
  { ruta = '/', rol }: OpcionesRenderizar = {},
) {
  if (rol) sesion.establecer(sesionDePrueba(TOKEN_DE_PRUEBA, rol));
  const queryClient = crearQueryClientDePrueba();
  const router = createMemoryRouter(rutas, { initialEntries: [ruta] });
  const usuario = userEvent.setup();
  const resultado = render(
    <Proveedores queryClient={queryClient}>
      <RouterProvider router={router} />
    </Proveedores>,
  );
  return { ...resultado, usuario, router, queryClient };
}

/** Monta `ui` en toda ruta del router en memoria (para probar un componente o una página sola). */
export function renderizar(ui: ReactElement, opciones: OpcionesRenderizar = {}) {
  return renderizarRutas([{ path: '*', element: ui }], opciones);
}
