import { registrarAjusteSchema, registrarEntradaSchema } from '@shopcart/shared';
import type { z } from 'zod';
import { enteroDelCampo } from '../../shared/formularios';

/** M7-H02: el ajuste de una variante; la variante la pone el diálogo, no el formulario. */
export const formularioAjusteSchema = registrarAjusteSchema.omit({ idVariante: true }).extend({
  cantidad: enteroDelCampo.pipe(registrarAjusteSchema.shape.cantidad),
});

/** M7-H02: la entrada, con la variante elegida en la búsqueda del diálogo. */
export const formularioEntradaSchema = registrarEntradaSchema.extend({
  cantidad: enteroDelCampo.pipe(registrarEntradaSchema.shape.cantidad),
});

export type FormularioAjuste = z.infer<typeof formularioAjusteSchema>;
