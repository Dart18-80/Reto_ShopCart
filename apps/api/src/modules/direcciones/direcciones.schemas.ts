import { textoNvarchar } from '@shopcart/shared';
import { z } from '../../shared/openapi/zod.js';

const telefonoSchema = z.string().regex(/^\d{8}$/, 'El teléfono debe tener 8 dígitos.');
const idSchema = z.coerce.number().int().positive();

// RF-01: .strict() rechaza un idUsuario colado en el cuerpo; el dueño sale del token.
export const crearDireccionSchema = z
  .object({
    alias: textoNvarchar(50).optional(),
    nombreRecibe: textoNvarchar(100),
    telefonoRecibe: telefonoSchema,
    idMunicipio: z.number().int().positive(),
    direccionLinea: textoNvarchar(200),
    referencia: textoNvarchar(200).optional(),
    esPredeterminada: z.boolean().default(false),
  })
  .strict()
  .openapi('CrearDireccion');

// PATCH: lo que no llega se conserva; alias y referencia en null se quitan.
export const actualizarDireccionSchema = z
  .object({
    alias: textoNvarchar(50).nullable().optional(),
    nombreRecibe: textoNvarchar(100).optional(),
    telefonoRecibe: telefonoSchema.optional(),
    idMunicipio: z.number().int().positive().optional(),
    direccionLinea: textoNvarchar(200).optional(),
    referencia: textoNvarchar(200).nullable().optional(),
    esPredeterminada: z.boolean().optional(),
  })
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un campo.')
  .openapi('ActualizarDireccion');

export const paramsIdDireccionSchema = z.object({ id: idSchema });
export const paramsIdDepartamentoSchema = z.object({ id: idSchema });

const departamentoSchema = z.object({ idDepartamento: z.number().int(), nombre: z.string() });
const municipioSchema = z.object({ idMunicipio: z.number().int(), nombre: z.string() });

export const direccionSchema = z
  .object({
    idDireccion: z.number().int(),
    alias: z.string().nullable(),
    nombreRecibe: z.string(),
    telefonoRecibe: z.string(),
    municipio: municipioSchema.extend({ departamento: departamentoSchema }),
    direccionLinea: z.string(),
    referencia: z.string().nullable(),
    esPredeterminada: z.boolean(),
  })
  .openapi('Direccion');

export const listaDepartamentosSchema = z.object({ datos: z.array(departamentoSchema) });
export const listaMunicipiosSchema = z.object({ datos: z.array(municipioSchema) });

export type CrearDireccion = z.infer<typeof crearDireccionSchema>;
export type ActualizarDireccion = z.infer<typeof actualizarDireccionSchema>;
