// FE-15: fuentes autoalojadas, solo con los pesos que usan los estilos de texto de Figma.
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Aplicacion } from './app/Aplicacion';
import './app/tema.css';

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('index.html no tiene el elemento #raiz.');

createRoot(raiz).render(
  <StrictMode>
    <Aplicacion />
  </StrictMode>,
);
