import { z } from 'zod';
import { LARGO_MAXIMO_TEXTO_BUSQUEDA } from './catalogo.js';
import {
  consultaPaginacionSchema,
  idEnRutaSchema,
  idSchema,
  rangoDeFechasSchema,
} from './consultas.js';
import { ordenConsultaSchema } from './orden.js';
import { textoNvarchar } from './texto.js';

/** N-08: los estados del pedido (EstadoPedido.Codigo, semilla S001), en el orden del ciclo. */
export const ESTADOS_PEDIDO = [
  'Pagado',
  'EnPreparacion',
  'Despachado',
  'Entregado',
  'Cancelado',
  'DevueltoParcial',
  'Devuelto',
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

// N-09: el motivo de una cancelación es obligatorio (textoNvarchar no admite solo espacios).
export const cancelarPedidoSchema = z.object({ motivo: textoNvarchar(250) }).strict();

export type CancelarPedido = z.infer<typeof cancelarPedidoSchema>;

// RF-07, N-08: un cambio de estado desde la gestión, con concurrencia optimista (estadoEsperado); el motivo es
// opcional (NVARCHAR(250)).
export const cambiarEstadoPedidoSchema = z
  .object({
    estadoEsperado: z.enum(ESTADOS_PEDIDO),
    estadoNuevo: z.enum(ESTADOS_PEDIDO),
    motivo: textoNvarchar(250).optional(),
  })
  .strict();

export type CambiarEstadoPedido = z.infer<typeof cambiarEstadoPedidoSchema>;

// M6-H01: numero se resuelve por IDPedido; estado, por EstadoPedido.Orden.
export const ordenPedidosGestionSchema = ordenConsultaSchema(
  ['fecha', 'total', 'numero', 'estado'],
  'fecha',
  'desc',
);

/**
 * RF-07, RF-08: la gestión de pedidos. Las fechas son días de Guatemala sobre FechaPagoLocal (A-12), igual que los
 * reportes (N-11); M8-H01: `cliente` busca por nombre (sin tildes ni mayúsculas) o correo, literal.
 */
export const consultaPedidosGestionSchema = rangoDeFechasSchema.safeExtend({
  ...consultaPaginacionSchema.shape,
  ...ordenPedidosGestionSchema.shape,
  estado: z.enum(ESTADOS_PEDIDO).optional(),
  idCliente: idEnRutaSchema.optional(),
  cliente: textoNvarchar(LARGO_MAXIMO_TEXTO_BUSQUEDA).optional(),
});

export type ConsultaPedidosGestion = z.infer<typeof consultaPedidosGestionSchema>;
export type OrdenPedidosGestion = z.infer<typeof ordenPedidosGestionSchema>;

// N-10: el SP valida contra lo vendido bajo bloqueo; aquí solo la forma (líneas únicas, cantidades > 0).
const MAX_LINEAS_DEVOLUCION = 50;
const CANTIDAD_MAXIMA_DEVOLUCION = 1_000_000;

export const registrarDevolucionSchema = z
  .object({
    motivo: textoNvarchar(250),
    lineas: z
      .array(
        z
          .object({
            idDetallePedido: idSchema,
            cantidad: z.number().int().min(1).max(CANTIDAD_MAXIMA_DEVOLUCION),
          })
          .strict(),
      )
      .min(1, 'Elige al menos una unidad para devolver.')
      .max(MAX_LINEAS_DEVOLUCION)
      .refine(
        (lineas) => new Set(lineas.map((l) => l.idDetallePedido)).size === lineas.length,
        'Una línea aparece más de una vez en la devolución.',
      ),
  })
  .strict();

export type RegistrarDevolucion = z.infer<typeof registrarDevolucionSchema>;
