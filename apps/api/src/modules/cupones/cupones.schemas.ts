import { montoSchema, ordenConsultaSchema, textoNvarchar } from '@shopcart/shared';
import { Decimal } from 'decimal.js';
import {
  booleanoConsultaSchema,
  consultaPaginacionSchema,
  idEnRutaSchema,
  idSchema,
} from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';
import { TIPOS_CUPON } from './cupones.types.js';

// Tope técnico de los límites de uso, lejos del desborde de INT.
const LIMITE_MAXIMO_USOS = 1_000_000;
const PORCENTAJE_MAXIMO = new Decimal(100);

const codigoSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_-]{3,30}$/,
    'El código lleva de 3 a 30 letras, números, guiones o guiones bajos.',
  )
  .openapi({ description: 'Se guarda en mayúsculas; único sin distinguir mayúsculas' });
const montoDecimalSchema = montoSchema.transform((valor) => new Decimal(valor));
const montoPositivoSchema = montoDecimalSchema.refine((valor) => valor.greaterThan(0), {
  message: 'Debe ser mayor que cero.',
});
const fechaSchema = z.iso.datetime({ offset: true }).transform((valor) => new Date(valor));
const limiteUsosSchema = z.number().int().min(1).max(LIMITE_MAXIMO_USOS);

const porcentajeValido = (cupon: { tipo?: string; valor?: Decimal }) =>
  cupon.tipo !== 'Porcentaje' ||
  cupon.valor === undefined ||
  cupon.valor.lessThanOrEqualTo(PORCENTAJE_MAXIMO);
const vigenciaValida = (cupon: { fechaInicio?: Date; fechaFin?: Date }) =>
  cupon.fechaInicio === undefined ||
  cupon.fechaFin === undefined ||
  cupon.fechaFin > cupon.fechaInicio;

export const crearCuponSchema = z
  .object({
    codigo: codigoSchema,
    descripcion: textoNvarchar(200),
    tipo: z.enum(TIPOS_CUPON),
    valor: montoPositivoSchema,
    montoMaximoDescuento: montoPositivoSchema.optional(),
    montoMinimoCompra: montoDecimalSchema.default(new Decimal(0)),
    idCategoria: idSchema.optional(),
    fechaInicio: fechaSchema,
    fechaFin: fechaSchema,
    limiteUsosTotal: limiteUsosSchema,
    limiteUsosPorCliente: limiteUsosSchema.default(1),
    activo: z.boolean().default(true),
  })
  .strict()
  .refine(porcentajeValido, { message: 'Un porcentaje no puede pasar de 100.', path: ['valor'] })
  .refine((cupon) => cupon.tipo === 'Porcentaje' || cupon.montoMaximoDescuento === undefined, {
    message: 'El tope de descuento solo aplica a cupones de porcentaje.',
    path: ['montoMaximoDescuento'],
  })
  .refine(vigenciaValida, {
    message: 'La fecha final debe ser posterior a la inicial.',
    path: ['fechaFin'],
  })
  .openapi('CrearCupon');

// PATCH: lo que no llega se conserva; montoMaximoDescuento e idCategoria en null se quitan.
export const actualizarCuponSchema = z
  .object({
    codigo: codigoSchema.optional(),
    descripcion: textoNvarchar(200).optional(),
    tipo: z.enum(TIPOS_CUPON).optional(),
    valor: montoPositivoSchema.optional(),
    montoMaximoDescuento: montoPositivoSchema.nullable().optional(),
    montoMinimoCompra: montoDecimalSchema.optional(),
    idCategoria: idSchema.nullable().optional(),
    fechaInicio: fechaSchema.optional(),
    fechaFin: fechaSchema.optional(),
    limiteUsosTotal: limiteUsosSchema.optional(),
    limiteUsosPorCliente: limiteUsosSchema.optional(),
  })
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un campo.')
  .refine(porcentajeValido, { message: 'Un porcentaje no puede pasar de 100.', path: ['valor'] })
  .refine(vigenciaValida, {
    message: 'La fecha final debe ser posterior a la inicial.',
    path: ['fechaFin'],
  })
  .openapi('ActualizarCupon');

export const paramsIdCuponSchema = z.object({ id: idEnRutaSchema });

export const listarCuponesSchema = consultaPaginacionSchema.extend({
  activo: booleanoConsultaSchema.optional(),
  // M6-H01: vigencia ordena por FechaInicio.
  ...ordenConsultaSchema(['codigo', 'vigencia', 'usos'], 'vigencia', 'desc').shape,
});

export const cuponSchema = z
  .object({
    idCupon: z.number().int(),
    codigo: z.string(),
    descripcion: z.string(),
    tipo: z.enum(TIPOS_CUPON),
    valor: montoSchema,
    montoMaximoDescuento: montoSchema.nullable(),
    montoMinimoCompra: montoSchema,
    categoria: z.object({ idCategoria: z.number().int(), nombre: z.string() }).nullable(),
    fechaInicio: z.iso.datetime(),
    fechaFin: z.iso.datetime(),
    limiteUsosTotal: z.number().int(),
    limiteUsosPorCliente: z.number().int(),
    usosComprometidos: z.number().int(),
    usado: z.boolean(),
    activo: z.boolean(),
  })
  .openapi('Cupon');

export type CrearCupon = z.infer<typeof crearCuponSchema>;
export type ActualizarCupon = z.infer<typeof actualizarCuponSchema>;
export type ListarCupones = z.infer<typeof listarCuponesSchema>;
