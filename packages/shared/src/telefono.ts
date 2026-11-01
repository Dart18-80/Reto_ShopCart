import { z } from 'zod';

/** Teléfono de Guatemala: 8 dígitos, igual que el CK de la base (VARCHAR(8)). */
export const telefonoSchema = z.string().regex(/^\d{8}$/, 'El teléfono debe tener 8 dígitos.');
