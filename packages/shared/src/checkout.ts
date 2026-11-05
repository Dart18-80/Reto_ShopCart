import { z } from 'zod';

// N-03: los datos de la tarjeta solo viajan a la pasarela; nunca se guardan ni se registran (pino redacta
// numeroTarjeta y cvv). La vigencia depende del reloj del servidor: la valida la API (pagarVigenteSchema).
export const pagarSchema = z
  .object({
    numeroTarjeta: z
      .string()
      .regex(/^\d{13,19}$/, 'El número de tarjeta tiene de 13 a 19 dígitos.'),
    mesVencimiento: z.number({ error: 'Elige el mes.' }).int().min(1).max(12),
    anioVencimiento: z.number({ error: 'Elige el año.' }).int().min(2000).max(2100),
    cvv: z.string().regex(/^\d{3,4}$/, 'El CVV tiene 3 o 4 dígitos.'),
  })
  .strict();

export type Pagar = z.infer<typeof pagarSchema>;
