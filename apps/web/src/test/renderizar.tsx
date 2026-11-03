import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

interface OpcionesRenderizar {
  /** URL inicial del router en memoria. */
  ruta?: string;
}

// Provisional (F1-H01): F1-H03 usa el QueryClient de la aplicación con sus reintentos apagados y F1-H04 agrega la
// sesión con un rol.
function crearQueryClientDePrueba() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
