import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { crearQueryClient, sesion } from '../shared/api';
import { Aplicacion } from './Aplicacion';

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

  const root = createRoot(raiz);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Aplicacion />
      </QueryClientProvider>
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
