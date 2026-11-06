import { z } from 'zod';
import { ILUSTRACIONES_PRENDA } from './catalogo.js';
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

export type CrearCategoria = z.infer<typeof crearCategoriaSchema>;
export type ActualizarCategoria = z.infer<typeof actualizarCategoriaSchema>;
export type CrearAtributo = z.infer<typeof crearAtributoSchema>;
export type CrearValorAtributo = z.infer<typeof crearValorAtributoSchema>;
