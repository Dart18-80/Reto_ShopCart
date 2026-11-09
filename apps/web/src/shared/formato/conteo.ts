// Separador de miles de Guatemala (1,532). Es un conteo, no un monto: los montos van con formatearMonto (FE-10).
const formatoConteo = new Intl.NumberFormat('es-GT');

/** «1,532»: una cantidad sola, como la cifra de una tarjeta del dashboard. */
export const formatearCantidad = (total: number) => formatoConteo.format(total);

/** «1 producto», «1,532 productos». */
export const formatearConteo = (total: number, singular: string, plural: string) =>
  `${formatearCantidad(total)} ${total === 1 ? singular : plural}`;
