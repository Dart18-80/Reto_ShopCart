import {
  actualizarCuponSchema as actualizarCompartido,
  consultaCuponesSchema,
  crearCuponSchema as crearCompartido,
  montoSchema,
  TIPOS_CUPON,
} from '@shopcart/shared';
import { Decimal } from 'decimal.js';
import { idEnRutaSchema } from '../../shared/http/index.js';
import { registroOpenApi } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';

// M9-H01 (FE-03): los cuerpos y la consulta viven en @shopcart/shared, con los montos y las fechas como texto
// (FE-10). Las rutas documentan el esquema compartido; el controlador valida con la versión de entrada, que
// además pasa los montos a Decimal (A-21) y las fechas a Date.
export const crearCuponSchema = registroOpenApi.register('CrearCupon', crearCompartido);
export const actualizarCuponSchema = registroOpenApi.register(
  'ActualizarCupon',
  actualizarCompartido,
);

// Un campo que no llegó sigue ausente (PATCH: se conserva); null en el tope lo quita (sqlserver-sp §9.5).
export const crearCuponEntradaSchema = crearCuponSchema.transform(
  ({ valor, montoMaximoDescuento, montoMinimoCompra, fechaInicio, fechaFin, ...resto }) => ({
    ...resto,
    valor: new Decimal(valor),
    montoMinimoCompra: new Decimal(montoMinimoCompra),
    fechaInicio: new Date(fechaInicio),
    fechaFin: new Date(fechaFin),
    ...(montoMaximoDescuento === undefined
      ? {}
      : { montoMaximoDescuento: new Decimal(montoMaximoDescuento) }),
  }),
);

export const actualizarCuponEntradaSchema = actualizarCuponSchema.transform(
  ({ valor, montoMaximoDescuento, montoMinimoCompra, fechaInicio, fechaFin, ...resto }) => ({
    ...resto,
    ...(valor === undefined ? {} : { valor: new Decimal(valor) }),
    ...(montoMinimoCompra === undefined
      ? {}
      : { montoMinimoCompra: new Decimal(montoMinimoCompra) }),
    ...(fechaInicio === undefined ? {} : { fechaInicio: new Date(fechaInicio) }),
    ...(fechaFin === undefined ? {} : { fechaFin: new Date(fechaFin) }),
    ...(montoMaximoDescuento === undefined
      ? {}
      : {
          montoMaximoDescuento:
            montoMaximoDescuento === null ? null : new Decimal(montoMaximoDescuento),
        }),
  }),
);

export const paramsIdCuponSchema = z.object({ id: idEnRutaSchema });

export const listarCuponesSchema = consultaCuponesSchema;

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

export type CrearCupon = z.output<typeof crearCuponEntradaSchema>;
export type ActualizarCupon = z.output<typeof actualizarCuponEntradaSchema>;
export type ListarCupones = z.infer<typeof listarCuponesSchema>;
