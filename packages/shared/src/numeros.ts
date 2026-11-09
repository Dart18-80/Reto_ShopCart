import { z } from 'zod';

const formatoEntero = new Intl.NumberFormat('es-GT');

/**
 * Un entero que escribe una persona (cantidades, límites, días, parámetros), con mensajes en español: los de Zod por
 * omisión saldrían en inglés en el formulario y en el 400 de la API.
 */
export const enteroEntre = (minimo: number, maximo: number) =>
  z
    .number({ error: 'Escribe un número.' })
    .int('Escribe un número entero.')
    .min(minimo, `Debe ser al menos ${formatoEntero.format(minimo)}.`)
    .max(maximo, `No puede pasar de ${formatoEntero.format(maximo)}.`);
