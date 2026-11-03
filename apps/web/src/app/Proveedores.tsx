import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ProveedorTema, useTema } from './tema/ProveedorTema';

function Avisos() {
  const { tema } = useTema();
  return <Toaster theme={tema === 'oscuro' ? 'dark' : 'light'} position="top-center" />;
}

/** Lo que toda la aplicación necesita alrededor del router: caché del servidor, tema y avisos. */
export function Proveedores({
  queryClient,
  children,
}: {
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <ProveedorTema>
        {children}
        <Avisos />
      </ProveedorTema>
    </QueryClientProvider>
  );
}
