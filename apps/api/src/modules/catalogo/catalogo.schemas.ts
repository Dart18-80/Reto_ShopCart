import { textoNvarchar } from '@shopcart/shared';
import { idEnRutaSchema } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';

// Los largos son los de la tabla y los SPs: Nombre NVARCHAR(80), Descripcion NVARCHAR(300).
export const crearCategoriaSchema = z
  .object({ nombre: textoNvarchar(80), descripcion: textoNvarchar(300).optional() })
  .strict()
  .openapi('CrearCategoria');

// PATCH: lo que no llega se conserva; descripcion en null se quita.
export const actualizarCategoriaSchema = z
  .object({
    nombre: textoNvarchar(80).optional(),
    descripcion: textoNvarchar(300).nullable().optional(),
  })
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un campo.')
  .openapi('ActualizarCategoria');

export const paramsIdCategoriaSchema = z.object({ id: idEnRutaSchema });

export const categoriaPublicaSchema = z
  .object({ idCategoria: z.number().int(), nombre: z.string(), descripcion: z.string().nullable() })
  .openapi('CategoriaPublica');

export const categoriaSchema = categoriaPublicaSchema
  .extend({ activo: z.boolean() })
  .openapi('Categoria');

// Orden de despliegue: SMALLINT en la tabla. Sin orden, el SP lo pone después del último.
const ordenSchema = z.number().int().min(0).max(32_767);

export const crearAtributoSchema = z
  .object({ nombre: textoNvarchar(50), orden: ordenSchema.optional() })
  .strict()
  .openapi('CrearAtributo');

export const crearValorAtributoSchema = z
  .object({ valor: textoNvarchar(50), orden: ordenSchema.optional() })
  .strict()
  .openapi('CrearValorAtributo');

export const paramsIdAtributoSchema = z.object({ id: idEnRutaSchema });

const valorAtributoSchema = z.object({
  idValorAtributo: z.number().int(),
  valor: z.string(),
  orden: z.number().int(),
});

export const valorAtributoCreadoSchema = valorAtributoSchema
  .extend({ idAtributo: z.number().int() })
  .openapi('ValorAtributo');

export const atributoSchema = z
  .object({
    idAtributo: z.number().int(),
    nombre: z.string(),
    orden: z.number().int(),
    valores: z.array(valorAtributoSchema),
  })
  .openapi('Atributo');

export type CrearCategoria = z.infer<typeof crearCategoriaSchema>;
export type ActualizarCategoria = z.infer<typeof actualizarCategoriaSchema>;
export type CrearAtributo = z.infer<typeof crearAtributoSchema>;
export type CrearValorAtributo = z.infer<typeof crearValorAtributoSchema>;
