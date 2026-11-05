import { montoSchema, pagarSchema as pagarCompartido } from '@shopcart/shared';
import { idSchema } from '../../shared/http/index.js';
import { registroOpenApi } from '../../shared/openapi/index.js';
import { z } from '../../shared/openapi/zod.js';
import { tarjetaVencida } from '../../shared/pasarela/index.js';
import type { Reloj } from '../../shared/reloj/index.js';

// RF-01: .strict() rechaza un idUsuario o un idCarrito colado en el cuerpo; los dos salen del token.
export const iniciarSesionSchema = z
  .object({ idDireccion: idSchema, idMetodoEnvio: idSchema })
  .strict()
  .openapi('IniciarSesionPago');

export const sesionPagoSchema = z
  .object({
    idSesion: z.number().int(),
    expiraEn: z.iso.datetime(),
    direccion: z.object({
      nombreRecibe: z.string(),
      telefonoRecibe: z.string(),
      idMunicipio: z.number().int(),
      municipio: z.string(),
      departamento: z.string(),
      direccionLinea: z.string(),
      referencia: z.string().nullable(),
    }),
    envio: z.object({
      idMetodoEnvio: z.number().int(),
      nombre: z.string(),
      diasMin: z.number().int(),
      diasMax: z.number().int(),
      costo: montoSchema,
    }),
    codigoCupon: z.string().nullable(),
    lineas: z.array(
      z.object({
        idVariante: z.number().int(),
        idProducto: z.number().int(),
        producto: z.string(),
        sku: z.string(),
        descripcionAtributos: z.string(),
        cantidad: z.number().int(),
        precioUnitario: montoSchema,
        descuentoLinea: montoSchema,
        totalLinea: montoSchema,
      }),
    ),
    subtotal: montoSchema,
    descuento: montoSchema,
    total: montoSchema,
    intentosRechazados: z.number().int(),
  })
  .openapi('SesionPago');

// FE-03: el cuerpo del pago vive en @shopcart/shared, el mismo que valida el formulario de la web.
export const pagarSchema = registroOpenApi.register('Pagar', pagarCompartido);

/** El cuerpo del pago con la tarjeta vigente a la fecha del reloj (la validación de la petición). */
export const pagarVigenteSchema = (reloj: Reloj) =>
  pagarSchema.superRefine((datos, contexto) => {
    if (tarjetaVencida(datos, reloj.ahora())) {
      contexto.addIssue({
        code: 'custom',
        path: ['anioVencimiento'],
        message: 'La tarjeta está vencida.',
      });
    }
  });

export type IniciarSesion = z.infer<typeof iniciarSesionSchema>;
