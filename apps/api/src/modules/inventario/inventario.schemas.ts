import { ordenConsultaSchema, textoNvarchar } from '@shopcart/shared';
import { consultaPaginacionSchema, idEnRutaSchema, idSchema } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';
import { TIPOS_MOVIMIENTO } from './inventario.types.js';

// Tope técnico de un movimiento: mantiene lejos el desborde de INT al sumar a la existencia.
const CANTIDAD_MAXIMA = 1_000_000;

// CA de E3-H06: un motivo ausente, vacío o de solo espacios lo rechaza el SP con MOTIVO_REQUERIDO, no Zod.
const motivoSchema = z.union([textoNvarchar(250), z.string().regex(/^\s*$/)]).optional();

export const registrarEntradaSchema = z
  .object({
    idVariante: idSchema,
    cantidad: z.number().int().min(1).max(CANTIDAD_MAXIMA),
    motivo: motivoSchema,
    referencia: textoNvarchar(100).optional(),
  })
  .strict()
  .openapi('RegistrarEntrada');

export const registrarAjusteSchema = z
  .object({
    idVariante: idSchema,
    cantidad: z
      .number()
      .int()
      .min(-CANTIDAD_MAXIMA)
      .max(CANTIDAD_MAXIMA)
      .refine((cantidad) => cantidad !== 0, 'La cantidad del ajuste no puede ser cero.'),
    motivo: motivoSchema,
  })
  .strict()
  .openapi('RegistrarAjuste');

export const consultaKardexSchema = consultaPaginacionSchema.extend({ variante: idEnRutaSchema });

export const consultaExistenciasSchema = consultaPaginacionSchema.extend({
  variante: idEnRutaSchema.optional(),
});

// M6-H01: solo la lista de existencias se ordena (la de bodega y el kardex conservan su orden).
export const ordenExistenciasSchema = ordenConsultaSchema(
  ['sku', 'producto', 'disponible'],
  'disponible',
  'asc',
);

export const listarExistenciasSchema = consultaExistenciasSchema.extend(
  ordenExistenciasSchema.shape,
);

export type OrdenExistencias = z.infer<typeof ordenExistenciasSchema>;

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
