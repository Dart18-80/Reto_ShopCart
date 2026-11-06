import { consultaPaginacionSchema, idEnRutaSchema } from '../../shared/http/index.js';
import { registroOpenApi } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import {
  consultaExistenciasSchema as consultaExistenciasCompartida,
  registrarAjusteSchema as registrarAjusteCompartido,
  registrarEntradaSchema as registrarEntradaCompartido,
} from '@shopcart/shared';
import { TIPOS_MOVIMIENTO } from './inventario.types.js';

// FE-03 (M7-H02): los cuerpos de entradas y ajustes viven en @shopcart/shared, los mismos que validan los
// formularios del backoffice.
export const registrarEntradaSchema = registroOpenApi.register(
  'RegistrarEntrada',
  registrarEntradaCompartido,
);
export const registrarAjusteSchema = registroOpenApi.register(
  'RegistrarAjuste',
  registrarAjusteCompartido,
);

export const consultaKardexSchema = consultaPaginacionSchema.extend({ variante: idEnRutaSchema });

export const consultaExistenciasSchema = consultaPaginacionSchema.extend({
  variante: idEnRutaSchema.optional(),
});

// M6-H01, M7-H01: la lista de existencias se ordena y se busca con la consulta de @shopcart/shared, la misma de la
// tabla del backoffice (la de bodega y el kardex conservan la suya).
export const listarExistenciasSchema = consultaExistenciasCompartida;

export const movimientoSchema = z
  .object({
    idMovimientoKardex: z.number().int(),
    idVariante: z.number().int(),
    tipo: z.enum(TIPOS_MOVIMIENTO),
    signo: z.number().int(),
    cantidad: z.number().int(),
    existenciaAnterior: z.number().int(),
    existenciaResultante: z.number().int(),
    motivo: z.string(),
    referencia: z.string().nullable(),
    idPedido: z.number().int().nullable(),
    idDevolucion: z.number().int().nullable(),
    usuario: z.object({ idUsuario: z.number().int(), nombre: z.string() }),
    fecha: z.iso.datetime(),
  })
  .openapi('Movimiento');

export const existenciaSchema = z
  .object({
    idVariante: z.number().int(),
    sku: z.string(),
    idProducto: z.number().int(),
    producto: z.string(),
    descripcionAtributos: z.string(),
    activo: z.boolean(),
    existenciaFisica: z.number().int(),
    reservado: z.number().int(),
    disponible: z.number().int(),
  })
  .openapi('Existencia');

export const descuadreSchema = z
  .object({
    idVariante: z.number().int(),
    sku: z.string(),
    existenciaFisica: z.number().int(),
    sumaKardex: z.number().int(),
    existenciaUltimoMovimiento: z.number().int().nullable(),
  })
  .openapi('Descuadre');

export const existenciaBodegaSchema = z
  .object({
    idVariante: z.number().int(),
    sku: z.string(),
    existenciaFisica: z.number().int(),
    unidadesPorDespachar: z.number().int(),
    existenciaBodega: z.number().int(),
  })
  .openapi('ExistenciaBodega');

export type RegistrarEntrada = z.infer<typeof registrarEntradaSchema>;
export type RegistrarAjuste = z.infer<typeof registrarAjusteSchema>;
