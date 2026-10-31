import { z } from 'zod';

/**
 * Campo de texto (no contraseñas) que termina en un parámetro NVARCHAR(maximo) de un SP. Recorta,
 * normaliza a NFC y mide en unidades UTF-16, igual que SQL Server: .max() de Zod cuenta puntos de
 * código, y un emoji que ocupa 2 unidades dejaría pasar un texto que no cabe en el parámetro.
 * El repositorio declara el parámetro con el mismo largo que el SP, nunca uno mayor.
 */
export function textoNvarchar(maximo: number) {
  return z
    .string()
    .transform((valor) => valor.trim().normalize('NFC'))
    .pipe(
      z
        .string()
        .min(1, 'No puede estar vacío.')
        .refine((valor) => valor.length <= maximo, `Máximo ${String(maximo)} caracteres.`),
    );
}
