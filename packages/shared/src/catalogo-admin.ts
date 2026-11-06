import { z } from 'zod';
import { ILUSTRACIONES_PRENDA, LARGO_MAXIMO_TEXTO_BUSQUEDA } from './catalogo.js';
import { booleanoConsultaSchema, consultaPaginacionSchema, idEnRutaSchema } from './consultas.js';
import { ordenConsultaSchema } from './orden.js';
import { textoNvarchar } from './texto.js';
import { alMenosUnCampo } from './usuarios.js';

const SIN_CAMPOS = 'Indica al menos un campo.';

// Orden de despliegue: SMALLINT en la tabla. Sin orden, el SP lo pone después del último.
export const ordenDespliegueSchema = z.number().int().min(0).max(32_767);

// FE-15: la misma lista del CHECK de la base; sin ilustración, la base pone la suya por defecto.
export const ilustracionSchema = z.enum(ILUSTRACIONES_PRENDA);

// --- Categorías (E3-H01). Largos de la tabla y los SPs: Nombre NVARCHAR(80), Descripcion NVARCHAR(300).

export const crearCategoriaSchema = z
  .object({
    nombre: textoNvarchar(80),
    descripcion: textoNvarchar(300).optional(),
    ilustracion: ilustracionSchema.optional(),
  })
  .strict();

// PATCH: lo que no llega se conserva; descripcion en null se quita.
export const actualizarCategoriaSchema = z
  .object({
    nombre: textoNvarchar(80).optional(),
    descripcion: textoNvarchar(300).nullable().optional(),
    ilustracion: ilustracionSchema.optional(),
  })
  .strict()
  .refine(alMenosUnCampo, SIN_CAMPOS);

// --- Atributos (E3-H02).

export const crearAtributoSchema = z
  .object({ nombre: textoNvarchar(50), orden: ordenDespliegueSchema.optional() })
  .strict();

export const crearValorAtributoSchema = z
  .object({ valor: textoNvarchar(50), orden: ordenDespliegueSchema.optional() })
  .strict();

// --- Productos (E3-H03, M6-H03).

// El mismo ID INT de idSchema, con el mensaje que ve quien no eligió la categoría en el formulario.
const ELIGE_UNA_CATEGORIA = 'Elige una categoría.';
const idCategoriaSchema = z.int32({ error: ELIGE_UNA_CATEGORIA }).positive(ELIGE_UNA_CATEGORIA);

export const crearProductoSchema = z
  .object({
    idCategoria: idCategoriaSchema,
    nombre: textoNvarchar(150),
    descripcion: textoNvarchar(2000).optional(),
    activo: z.boolean().default(true),
  })
  .strict();

export const ordenProductosAdminSchema = ordenConsultaSchema(
  ['nombre', 'categoria', 'recientes'],
  'nombre',
  'asc',
);

// "categoria", igual que en la búsqueda pública.
export const consultaProductosAdminSchema = consultaPaginacionSchema.extend({
  categoria: idEnRutaSchema.optional(),
  activo: booleanoConsultaSchema.optional(),
  texto: textoNvarchar(LARGO_MAXIMO_TEXTO_BUSQUEDA).optional(),
  ...ordenProductosAdminSchema.shape,
});

export type CrearCategoria = z.infer<typeof crearCategoriaSchema>;
export type ActualizarCategoria = z.infer<typeof actualizarCategoriaSchema>;
export type CrearAtributo = z.infer<typeof crearAtributoSchema>;
export type CrearValorAtributo = z.infer<typeof crearValorAtributoSchema>;
export type CrearProducto = z.infer<typeof crearProductoSchema>;
export type ConsultaProductosAdmin = z.infer<typeof consultaProductosAdminSchema>;
export type OrdenProductosAdmin = z.infer<typeof ordenProductosAdminSchema>;
