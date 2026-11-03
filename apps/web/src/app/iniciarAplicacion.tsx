import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { crearQueryClient, sesion } from '../shared/api';
import { Proveedores } from './Proveedores';
import { crearRutas } from './router';

/** Arranca la aplicación en `raiz`. Devuelve el QueryClient y cómo desmontarla (las pruebas lo usan). */
export function iniciarAplicacion(raiz: HTMLElement) {
  // FE-05: el refresh sale antes de montar React, fuera de todo efecto, así StrictMode no lo duplica. React monta
  // de inmediato con la sesión en «rehidratando» y las peticiones esperan a que termine.
  void sesion.rehidratar();

  const queryClient = crearQueryClient();
  // El siguiente usuario de este navegador no ve en la caché los datos del anterior.
  const dejarDeVaciar = sesion.alCambiarUsuario(() => {
    queryClient.clear();
  });

  const router = createBrowserRouter(crearRutas());
  const root = createRoot(raiz);
  root.render(
    <StrictMode>
      <Proveedores queryClient={queryClient}>
        <RouterProvider router={router} />
      </Proveedores>
    </StrictMode>,
  );

  return {
    queryClient,
    desmontar() {
      root.unmount();
      dejarDeVaciar();
    },
  };
}
