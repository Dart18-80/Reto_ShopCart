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

const formatoDia = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA_DE_LA_TIENDA,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const formatoDiaYMes = new Intl.DateTimeFormat('es-GT', {
  timeZone: ZONA_DE_LA_TIENDA,
  day: 'numeric',
  month: 'long',
});

// Las abreviaturas de Intl para es-GT; una prueba verifica que coinciden con las de formatearFechaHora.
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const PATRON_CALENDARIO = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
// Un instante del backend: fecha, hora y zona explícita (Z o ±hh:mm). Sin zona, cada navegador lo leería en la suya.
const PATRON_INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const FEBRERO = 2;

const esBisiesto = (anio: number) => (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;

function diasDelMes(anio: number, mes: number): number {
  if (mes === FEBRERO && esBisiesto(anio)) return 29;
  return DIAS_POR_MES[mes - 1] ?? 0;
}

function aInstante(instante: string): Date {
  const fecha = PATRON_INSTANTE.test(instante) ? new Date(instante) : null;
  if (!fecha || Number.isNaN(fecha.getTime())) {
    throw new Error(`«${instante}» no es una fecha con hora (ISO 8601 con zona).`);
  }
  return fecha;
}

/** Un instante del backend (ISO 8601 en UTC) en la hora de Guatemala: «3 nov 2026, 23:30». */
export const formatearFechaHora = (instante: string): string =>
  formatoFechaHora.format(aInstante(instante));

/** El día de Guatemala de un instante, sin hora: «1 oct 2026» (la vigencia de un precio, M6-H05). */
export const formatearDia = (instante: string): string => formatoDia.format(aInstante(instante));

/** El día de Guatemala de un instante, sin año ni hora: «8 de noviembre» (la garantía del carrito). */
export const formatearDiaYMes = (instante: string): string =>
  formatoDiaYMes.format(aInstante(instante));

/**
 * Una fecha sin hora («2026-11-03»): nunca pasa por `new Date()`, que la leería como medianoche UTC, es decir,
 * el día anterior en Guatemala. Se arma con sus partes.
 */
export function formatearFechaCalendario(fecha: string): string {
  const noExiste = () => new Error(`«${fecha}» no es una fecha AAAA-MM-DD que exista.`);
  const partes = PATRON_CALENDARIO.exec(fecha);
  if (!partes) throw noExiste();
  const [, anio = '', mes = '', dia = ''] = partes;
  const numeroMes = parseInt(mes, 10);
  const numeroDia = parseInt(dia, 10);
  if (numeroDia > diasDelMes(parseInt(anio, 10), numeroMes)) throw noExiste();
  return `${String(numeroDia)} ${MESES[numeroMes - 1] ?? ''} ${anio}`;
}

// --- Fecha y hora escritas en un formulario (`<input type="datetime-local">`, M9-H01: la vigencia de un cupón).

// A-12: Guatemala está en UTC−6 todo el año (no tiene horario de verano).
const DESFASE_GUATEMALA = '-06:00';
const PATRON_ENTRADA_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const formatoEntradaLocal = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_DE_LA_TIENDA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Un instante del backend como lo muestra `datetime-local` en la hora de Guatemala: «2026-11-03T23:30». */
export function aEntradaLocal(instante: string): string {
  const partes = Object.fromEntries(
    formatoEntradaLocal.formatToParts(aInstante(instante)).map((p) => [p.type, p.value]),
  );
  return `${partes.year ?? ''}-${partes.month ?? ''}-${partes.day ?? ''}T${partes.hour ?? ''}:${partes.minute ?? ''}`;
}

/** Si el texto es lo que entrega `datetime-local` («2026-11-03T23:30»). */
export const esEntradaLocal = (texto: string): boolean => PATRON_ENTRADA_LOCAL.test(texto);

/** Lo que se escribió en `datetime-local`, leído como hora de Guatemala, como instante ISO con su zona. */
export function deEntradaLocal(local: string): string {
  if (!esEntradaLocal(local)) {
    throw new Error(`«${local}» no es una fecha y hora AAAA-MM-DDTHH:mm.`);
  }
  return `${local}:00${DESFASE_GUATEMALA}`;
}
