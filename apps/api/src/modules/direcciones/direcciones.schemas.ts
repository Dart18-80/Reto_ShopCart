import {
  actualizarDireccionSchema as actualizarDireccionCompartido,
  crearDireccionSchema as crearDireccionCompartido,
} from '@shopcart/shared';
import { idEnRutaSchema } from '../../shared/http/index.js';
import { registroOpenApi } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';

// FE-03: los cuerpos viven en @shopcart/shared, los mismos que valida el formulario de la web.
export const crearDireccionSchema = registroOpenApi.register(
  'CrearDireccion',
  crearDireccionCompartido,
);
export const actualizarDireccionSchema = registroOpenApi.register(
  'ActualizarDireccion',
  actualizarDireccionCompartido,
);

export const paramsIdDireccionSchema = z.object({ id: idEnRutaSchema });
export const paramsIdDepartamentoSchema = z.object({ id: idEnRutaSchema });

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

export type { ActualizarDireccion, CrearDireccion } from '@shopcart/shared';
