import { useState } from 'react';

/**
 * Si la animación de entrada sigue vigente: solo mientras el contenido es el del primer render. `firma` resume lo
 * que se muestra (las claves de las filas o de las barras); en cuanto cambia (otra página, otro orden, otro filtro,
 * un dato nuevo) deja de serlo para siempre, también si después vuelve al contenido inicial. Así lo que llega
 * después aparece sin animar.
 */
export function useEntradaInicial(firma: string): boolean {
  const [firmaInicial] = useState(firma);
  const [vigente, setVigente] = useState(true);
  // Ajuste del estado durante el render, sin efecto: el render con contenido nuevo ya sale sin la animación.
  if (vigente && firma !== firmaInicial) setVigente(false);
  return vigente && firma === firmaInicial;
}
