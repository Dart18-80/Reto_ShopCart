import { z } from 'zod';
import { booleanoConsultaSchema, consultaPaginacionSchema, idSchema } from './consultas.js';
import { montoMenorOIgual, montoSchema } from './monto.js';
import { ordenConsultaSchema } from './orden.js';
import { textoNvarchar } from './texto.js';

// RF-05, N-12: los cupones del Admin (E4-H04; M9-H01 los usa en el backoffice, FE-03). Los montos y los
// porcentajes viajan como texto (FE-10): la API los pasa a Decimal y las fechas a Date al validar la entrada.

export const TIPOS_CUPON = ['Porcentaje', 'MontoFijo'] as const;
export type TipoCupon = (typeof TIPOS_CUPON)[number];

// Tope técnico de los límites de uso, lejos del desborde de INT.
const LIMITE_MAXIMO_USOS = 1_000_000;
const PORCENTAJE_MAXIMO = '100';
const CERO = '0';
export const MONTO_MINIMO_POR_OMISION = '0.00';

const codigoCuponSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_-]{3,30}$/,
    'El código lleva de 3 a 30 letras, números, guiones o guiones bajos.',
  )
  .describe('Se guarda en mayúsculas; único sin distinguir mayúsculas');

const montoPositivoSchema = montoSchema.refine((valor) => !montoMenorOIgual(valor, CERO), {
  message: 'Debe ser mayor que cero.',
});
const fechaSchema = z.iso.datetime({ offset: true });
const limiteUsosSchema = z.number().int().min(1).max(LIMITE_MAXIMO_USOS);

const porcentajeValido = (cupon: { tipo?: string; valor?: string }) =>
  cupon.tipo !== 'Porcentaje' ||
  cupon.valor === undefined ||
  montoMenorOIgual(cupon.valor, PORCENTAJE_MAXIMO);
const vigenciaValida = (cupon: { fechaInicio?: string; fechaFin?: string }) =>
  cupon.fechaInicio === undefined ||
  cupon.fechaFin === undefined ||
  Date.parse(cupon.fechaFin) > Date.parse(cupon.fechaInicio);

const MENSAJE_PORCENTAJE = { message: 'Un porcentaje no puede pasar de 100.', path: ['valor'] };
const MENSAJE_VIGENCIA = {
  message: 'La fecha final debe ser posterior a la inicial.',
  path: ['fechaFin'],
};

export const crearCuponSchema = z
  .object({
    codigo: codigoCuponSchema,
    descripcion: textoNvarchar(200),
    tipo: z.enum(TIPOS_CUPON),
    valor: montoPositivoSchema,
    montoMaximoDescuento: montoPositivoSchema.optional(),
    montoMinimoCompra: montoSchema.default(MONTO_MINIMO_POR_OMISION),
    idCategoria: idSchema.optional(),
    fechaInicio: fechaSchema,
    fechaFin: fechaSchema,
    limiteUsosTotal: limiteUsosSchema,
    limiteUsosPorCliente: limiteUsosSchema.default(1),
    activo: z.boolean().default(true),
  })
  .strict()
  .refine(porcentajeValido, MENSAJE_PORCENTAJE)
  .refine((cupon) => cupon.tipo === 'Porcentaje' || cupon.montoMaximoDescuento === undefined, {
    message: 'El tope de descuento solo aplica a cupones de porcentaje.',
    path: ['montoMaximoDescuento'],
  })
  .refine(vigenciaValida, MENSAJE_VIGENCIA);

// PATCH: lo que no llega se conserva; montoMaximoDescuento e idCategoria en null se quitan.
export const actualizarCuponSchema = z
  .object({
    codigo: codigoCuponSchema.optional(),
    descripcion: textoNvarchar(200).optional(),
    tipo: z.enum(TIPOS_CUPON).optional(),
    valor: montoPositivoSchema.optional(),
    montoMaximoDescuento: montoPositivoSchema.nullable().optional(),
    montoMinimoCompra: montoSchema.optional(),
    idCategoria: idSchema.nullable().optional(),
    fechaInicio: fechaSchema.optional(),
    fechaFin: fechaSchema.optional(),
    limiteUsosTotal: limiteUsosSchema.optional(),
    limiteUsosPorCliente: limiteUsosSchema.optional(),
  })
  .strict()
  .refine((cambios) => Object.keys(cambios).length > 0, 'Indica al menos un campo.')
  .refine(porcentajeValido, MENSAJE_PORCENTAJE)
  .refine(vigenciaValida, MENSAJE_VIGENCIA);

// M6-H01: vigencia ordena por FechaInicio.
export const ordenCuponesSchema = ordenConsultaSchema(
  ['codigo', 'vigencia', 'usos'],
  'vigencia',
  'desc',
);

export const consultaCuponesSchema = consultaPaginacionSchema.extend({
  activo: booleanoConsultaSchema.optional(),
  ...ordenCuponesSchema.shape,
});

export type CrearCupon = z.infer<typeof crearCuponSchema>;
export type ActualizarCupon = z.infer<typeof actualizarCuponSchema>;
export type ConsultaCupones = z.infer<typeof consultaCuponesSchema>;
export type OrdenCupones = z.infer<typeof ordenCuponesSchema>;
