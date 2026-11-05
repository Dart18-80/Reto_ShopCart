import { z } from 'zod';
import { contrasenaSchema } from './auth.js';
import { telefonoSchema } from './telefono.js';
import { textoNvarchar } from './texto.js';

/** Un PATCH sin campos no tiene nada que cambiar. */
export const alMenosUnCampo = (cambios: object) => Object.keys(cambios).length > 0;

// RF-01: el cliente nunca manda su ID; .strict() rechaza cualquier campo que no sea editable.
export const actualizarPerfilSchema = z
  .object({ nombre: textoNvarchar(100).optional(), telefono: telefonoSchema.nullable().optional() })
  .strict()
  .refine(alMenosUnCampo, 'Indica al menos un campo.');

export const cambiarContrasenaSchema = z
  .object({ contrasenaActual: z.string().min(1).max(128), contrasenaNueva: contrasenaSchema })
  .strict();

export type ActualizarPerfil = z.infer<typeof actualizarPerfilSchema>;
export type CambiarContrasena = z.infer<typeof cambiarContrasenaSchema>;
