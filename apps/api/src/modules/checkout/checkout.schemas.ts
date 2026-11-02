import { montoSchema } from '@shopcart/shared';
import { idSchema } from '../../shared/http/index.js';
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

// N-03: los datos de la tarjeta solo viajan a la pasarela; nunca se guardan ni se registran (pino redacta
// numeroTarjeta y cvv).
export const pagarSchema = z
  .object({
    numeroTarjeta: z
      .string()
      .regex(/^\d{13,19}$/, 'El número de tarjeta tiene de 13 a 19 dígitos.'),
    mesVencimiento: z.number().int().min(1).max(12),
    anioVencimiento: z.number().int().min(2000).max(2100),
    cvv: z.string().regex(/^\d{3,4}$/, 'El CVV tiene 3 o 4 dígitos.'),
  })
  .strict()
  .openapi('Pagar');

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
