const MS_POR_SEGUNDO = 1000;
const SEGUNDOS_POR_MINUTO = 60;

/** Lo que falta para `expiraEn` (ISO con hora), en milisegundos; nunca negativo. */
export function restanteHasta(expiraEn: string, ahora: number): number {
  return Math.max(0, Date.parse(expiraEn) - ahora);
}

/** «14:32»: minutos y segundos que faltan, redondeando hacia arriba para no mostrar 00:00 antes de tiempo. */
export function formatearRestante(restanteMs: number): string {
  const segundos = Math.ceil(restanteMs / MS_POR_SEGUNDO);
  const minutos = Math.floor(segundos / SEGUNDOS_POR_MINUTO);
  const resto = segundos % SEGUNDOS_POR_MINUTO;
  return `${String(minutos).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}
