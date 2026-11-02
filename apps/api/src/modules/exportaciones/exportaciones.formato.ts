// A-12: Guatemala está en UTC−6 todo el año (sin horario de verano).
const DESFASE_GUATEMALA_MS = -6 * 60 * 60 * 1000;

const dosDigitos = (n: number): string => String(n).padStart(2, '0');

/** La misma hora, con sus componentes UTC iguales a los de la hora de Guatemala. */
export const aHoraDeGuatemala = (fecha: Date): Date =>
  new Date(fecha.getTime() + DESFASE_GUATEMALA_MS);

/** "dd/mm/aaaa hh:mm" en hora de Guatemala. */
export function fechaHoraDeGuatemala(fecha: Date): string {
  const local = aHoraDeGuatemala(fecha);
  return (
    `${dosDigitos(local.getUTCDate())}/${dosDigitos(local.getUTCMonth() + 1)}/${String(local.getUTCFullYear())} ` +
    `${dosDigitos(local.getUTCHours())}:${dosDigitos(local.getUTCMinutes())}`
  );
}

/** "aaaa-mm-dd_hhmm" en hora de Guatemala, para el nombre del archivo descargado. */
export function sufijoDeFecha(fecha: Date): string {
  const local = aHoraDeGuatemala(fecha);
  return (
    `${String(local.getUTCFullYear())}-${dosDigitos(local.getUTCMonth() + 1)}-${dosDigitos(local.getUTCDate())}_` +
    `${dosDigitos(local.getUTCHours())}${dosDigitos(local.getUTCMinutes())}`
  );
}

export const leyendaDatosAl = (fecha: Date): string =>
  `Datos al ${fechaHoraDeGuatemala(fecha)} (hora de Guatemala)`;
