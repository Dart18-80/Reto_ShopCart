import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { CSSProperties, ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ProveedorTema, useTema } from './tema/ProveedorTema';

function Avisos() {
  const { tema } = useTema();
  return (
    <Toaster
      theme={tema === 'oscuro' ? 'dark' : 'light'}
      position="top-center"
      // Los avisos toman los colores del tema, como el componente sonner de shadcn.
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as CSSProperties
      }
    />
  );
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
