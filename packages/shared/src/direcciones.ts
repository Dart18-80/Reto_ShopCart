import { z } from 'zod';
import { telefonoSchema } from './telefono.js';
import { textoNvarchar } from './texto.js';

// El mismo ID INT de idSchema, con el mensaje que ve quien llena el formulario sin elegir municipio.
const ELIGE_UN_MUNICIPIO = 'Elige un municipio.';
const idMunicipioSchema = z.int32({ error: ELIGE_UN_MUNICIPIO }).positive(ELIGE_UN_MUNICIPIO);

// RF-01: .strict() rechaza un idUsuario colado en el cuerpo; el dueño sale del token.
export const crearDireccionSchema = z
  .object({
    alias: textoNvarchar(50).optional(),
    nombreRecibe: textoNvarchar(100),
    telefonoRecibe: telefonoSchema,
    idMunicipio: idMunicipioSchema,
    direccionLinea: textoNvarchar(200),
    referencia: textoNvarchar(200).optional(),
    esPredeterminada: z.boolean().default(false),
  })
  .strict();

// PATCH: lo que no llega se conserva; alias y referencia en null se quitan.
export const actualizarDireccionSchema = z
  .object({
    alias: textoNvarchar(50).nullable().optional(),
    nombreRecibe: textoNvarchar(100).optional(),
    telefonoRecibe: telefonoSchema.optional(),
    idMunicipio: idMunicipioSchema.optional(),
    direccionLinea: textoNvarchar(200).optional(),
    referencia: textoNvarchar(200).nullable().optional(),
    esPredeterminada: z.boolean().optional(),
  })
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un campo.');

export type CrearDireccion = z.infer<typeof crearDireccionSchema>;
export type ActualizarDireccion = z.infer<typeof actualizarDireccionSchema>;
