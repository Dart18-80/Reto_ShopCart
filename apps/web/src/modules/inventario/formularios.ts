import { registrarAjusteSchema, registrarEntradaSchema } from '@shopcart/shared';
import { z } from 'zod';

// El campo de texto entrega lo que se escribió; las reglas de la cantidad son las del esquema compartido (FE-03):
// aquí solo se convierte el texto en el entero que pide la API.
const enteroDelCampo = z
  .string()
  .trim()
  .regex(/^-?\d+$/, 'Escribe un número entero.')
  .transform(Number);

/** M7-H02: el ajuste de una variante; la variante la pone el diálogo, no el formulario. */
export const formularioAjusteSchema = registrarAjusteSchema.omit({ idVariante: true }).extend({
  cantidad: enteroDelCampo.pipe(registrarAjusteSchema.shape.cantidad),
});

/** M7-H02: la entrada, con la variante elegida en la búsqueda del diálogo. */
export const formularioEntradaSchema = registrarEntradaSchema.extend({
  cantidad: enteroDelCampo.pipe(registrarEntradaSchema.shape.cantidad),
});

export type FormularioAjuste = z.infer<typeof formularioAjusteSchema>;
