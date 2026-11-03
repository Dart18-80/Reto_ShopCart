import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
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
 * Monta `ui` con un QueryClient nuevo sin reintentos, un router en memoria que muestra `ui` en toda ruta y, si se
 * indica, la sesión con un rol. `configuracion.ts` olvida la sesión después de cada prueba.
 */
export function renderizar(ui: ReactElement, { ruta = '/', rol }: OpcionesRenderizar = {}) {
  if (rol) sesion.establecer(sesionDePrueba(TOKEN_DE_PRUEBA, rol));
  const queryClient = crearQueryClientDePrueba();
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [ruta] });
  const usuario = userEvent.setup();
  const resultado = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...resultado, usuario, router, queryClient };
}
