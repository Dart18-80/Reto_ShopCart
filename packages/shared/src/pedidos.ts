import { z } from 'zod';
import { textoNvarchar } from './texto.js';

// N-09: el motivo de una cancelación es obligatorio (textoNvarchar no admite solo espacios).
export const cancelarPedidoSchema = z.object({ motivo: textoNvarchar(250) }).strict();

export type CancelarPedido = z.infer<typeof cancelarPedidoSchema>;
