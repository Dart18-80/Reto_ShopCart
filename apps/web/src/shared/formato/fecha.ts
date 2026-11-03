// FE-10: toda fecha con hora se muestra en la hora de Guatemala, no en la del navegador (A-12).
const ZONA_DE_LA_TIENDA = 'America/Guatemala';

const formatoFechaHora = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA_DE_LA_TIENDA,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Las abreviaturas de Intl para es-GT; una prueba verifica que coinciden con las de formatearFechaHora.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const PATRON_CALENDARIO = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** Un instante del backend (ISO 8601 en UTC) en la hora de Guatemala: «3 nov 2026, 23:30». */
export function formatearFechaHora(instante: string): string {
  const fecha = new Date(instante);
  if (Number.isNaN(fecha.getTime())) throw new Error(`«${instante}» no es una fecha con hora.`);
  return formatoFechaHora.format(fecha);
}

/**
 * Una fecha sin hora («2026-11-03»): nunca pasa por `new Date()`, que la leería como medianoche UTC, es decir,
 * el día anterior en Guatemala. Se arma con sus partes.
 */
export function formatearFechaCalendario(fecha: string): string {
  const partes = PATRON_CALENDARIO.exec(fecha);
  if (!partes) throw new Error(`«${fecha}» no es una fecha AAAA-MM-DD.`);
  const [, anio = '', mes = '', dia = ''] = partes;
  return `${String(parseInt(dia, 10))} ${MESES[parseInt(mes, 10) - 1] ?? ''} ${anio}`;
}
