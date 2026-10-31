import argon2 from 'argon2';

// §10: argon2id con 19 MiB de memoria y 2 iteraciones (recomendación de OWASP).
const PARAMETROS = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
} as const;

// Hash de una contraseña aleatoria descartada: con un correo inexistente se verifica contra él para
// que la respuesta tarde lo mismo que con una contraseña incorrecta y no revele qué correos existen.
const HASH_DE_RELLENO =
  '$argon2id$v=19$m=19456,p=1,t=2$/NWjO0XT1AgbDe4dR/GQRA$ncTmD7hvKa8s+kbwYrJI7jFe8VnL+WvocYWgAcoOefE';

export function hashearContrasena(contrasena: string): Promise<string> {
  return argon2.hash(contrasena, PARAMETROS);
}

/** Con hash undefined (usuario inexistente) también hace el trabajo de argon2 y devuelve false. */
export async function verificarContrasena(
  hash: string | undefined,
  contrasena: string,
): Promise<boolean> {
  const coincide = await argon2.verify(hash ?? HASH_DE_RELLENO, contrasena);
  return hash !== undefined && coincide;
}
