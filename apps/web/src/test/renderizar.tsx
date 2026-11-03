import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { crearQueryClient } from '../shared/api';

interface OpcionesRenderizar {
  /** URL inicial del router en memoria. */
  ruta?: string;
}

// El QueryClient de la aplicación con los reintentos apagados: un error se ve en el primer intento. F1-H04
// agrega la sesión con un rol.
function crearQueryClientDePrueba() {
  const queryClient = crearQueryClient();
  const { queries } = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({ queries: { ...queries, retry: false } });
  return queryClient;
}

/** Monta `ui` con un QueryClient nuevo sin reintentos y un router en memoria que muestra `ui` en toda ruta. */
export function renderizar(ui: ReactElement, { ruta = '/' }: OpcionesRenderizar = {}) {
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
