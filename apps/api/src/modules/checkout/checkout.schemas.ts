import { montoSchema } from '@shopcart/shared';
import { idSchema } from '../../shared/http/index.js';
import { z } from '../../shared/openapi/zod.js';

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

export type IniciarSesion = z.infer<typeof iniciarSesionSchema>;
