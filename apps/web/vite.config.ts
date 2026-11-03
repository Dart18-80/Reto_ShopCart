import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Condición de exports de @shopcart/shared que apunta a su código fuente (01 §12): en desarrollo no hace falta
// compilarlo antes. El build de Docker lo compila primero y resuelve igual desde src.
const CONDICION_FUENTE = '@shopcart/fuente';

// 05 §5: la SPA y la API comparten origen también en desarrollo, así las cookies se comportan igual que con nginx.
const ORIGEN_API_LOCAL = 'http://localhost:8080';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    conditions: [CONDICION_FUENTE],
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: { '/api': { target: ORIGEN_API_LOCAL, changeOrigin: false } },
  },
});
