import {
  actualizarCuponSchema,
  crearCuponSchema,
  idSchema,
  MONTO_MINIMO_POR_OMISION,
  TIPOS_CUPON,
} from '@shopcart/shared';
import { z } from 'zod';
import { aEntradaLocal, deEntradaLocal, esEntradaLocal } from '../../shared/formato/fecha';
import type { Cupon } from './cupones.api';

// Los campos de texto entregan lo que se escribió; las reglas son las de los esquemas compartidos (FE-03). Aquí
// solo se convierte: un texto vacío es «no llegó», los límites a enteros y la vigencia (hora de Guatemala) a un
// instante ISO.
const enteroDelCampo = z
  .string()
  .trim()
  .regex(/^\d+$/, 'Escribe un número entero.')
  .transform(Number);
const fechaDelCampo = z.string().refine(esEntradaLocal, 'Elige la fecha y la hora.');
const textoOpcional = (texto: string) => (texto.trim() === '' ? undefined : texto.trim());

const camposDelCupon = z.object({
  codigo: z.string(),
  descripcion: z.string(),
  tipo: z.enum(TIPOS_CUPON),
  valor: z.string().trim(),
  montoMaximoDescuento: z.string(),
  montoMinimoCompra: z.string(),
  idCategoria: idSchema.optional(),
  fechaInicio: fechaDelCampo,
  fechaFin: fechaDelCampo,
  limiteUsosTotal: enteroDelCampo,
  limiteUsosPorCliente: enteroDelCampo,
});

const comunes = (campos: z.output<typeof camposDelCupon>) => ({
  codigo: campos.codigo,
  descripcion: campos.descripcion,
  tipo: campos.tipo,
  valor: campos.valor,
  fechaInicio: deEntradaLocal(campos.fechaInicio),
  fechaFin: deEntradaLocal(campos.fechaFin),
  limiteUsosTotal: campos.limiteUsosTotal,
  limiteUsosPorCliente: campos.limiteUsosPorCliente,
});

/** M9-H01: el alta; lo que se deja vacío no se envía y el backend pone su valor por omisión. */
export const formularioNuevoCuponSchema = camposDelCupon
  .extend({ activo: z.boolean() })
  // Anotado con la entrada del esquema compartido: `pipe` exige que lo producido sea exactamente lo que acepta.
  .transform((campos): z.input<typeof crearCuponSchema> => {
    const tope = textoOpcional(campos.montoMaximoDescuento);
    const minimo = textoOpcional(campos.montoMinimoCompra);
    return {
      ...comunes(campos),
      ...(tope === undefined ? {} : { montoMaximoDescuento: tope }),
      ...(minimo === undefined ? {} : { montoMinimoCompra: minimo }),
      ...(campos.idCategoria === undefined ? {} : { idCategoria: campos.idCategoria }),
      activo: campos.activo,
    };
  })
  .pipe(crearCuponSchema);

/**
 * M9-H01: la edición envía todo el formulario; vaciar el tope o elegir «Toda la tienda» los quita (null en el
 * PATCH). Un campo que no cambió no cuenta como cambio para un cupón ya usado (lo decide el SP).
 */
export const formularioEditarCuponSchema = camposDelCupon
  .transform((campos): z.input<typeof actualizarCuponSchema> => ({
    ...comunes(campos),
    montoMaximoDescuento: textoOpcional(campos.montoMaximoDescuento) ?? null,
    montoMinimoCompra: textoOpcional(campos.montoMinimoCompra) ?? MONTO_MINIMO_POR_OMISION,
    idCategoria: campos.idCategoria ?? null,
  }))
  .pipe(actualizarCuponSchema);

export type CamposCupon = z.input<typeof formularioNuevoCuponSchema>;
export type CamposEdicionCupon = z.input<typeof formularioEditarCuponSchema>;

export const CAMPOS_VACIOS: CamposCupon = {
  codigo: '',
  descripcion: '',
  tipo: 'Porcentaje',
  valor: '',
  montoMaximoDescuento: '',
  montoMinimoCompra: '',
  fechaInicio: '',
  fechaFin: '',
  limiteUsosTotal: '',
  limiteUsosPorCliente: '1',
  activo: true,
};

/** El cupón guardado como lo muestra el formulario de edición (la vigencia en hora de Guatemala). */
export const camposDe = (cupon: Cupon): CamposEdicionCupon => ({
  codigo: cupon.codigo,
  descripcion: cupon.descripcion,
  tipo: cupon.tipo,
  valor: cupon.valor,
  montoMaximoDescuento: cupon.montoMaximoDescuento ?? '',
  montoMinimoCompra: cupon.montoMinimoCompra,
  idCategoria: cupon.categoria?.idCategoria,
  fechaInicio: aEntradaLocal(cupon.fechaInicio),
  fechaFin: aEntradaLocal(cupon.fechaFin),
  limiteUsosTotal: String(cupon.limiteUsosTotal),
  limiteUsosPorCliente: String(cupon.limiteUsosPorCliente),
});
