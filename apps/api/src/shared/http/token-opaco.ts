import { createHash, randomBytes } from 'node:crypto';

// A-07, N-05: 256 bits aleatorios; en la base solo se guarda su SHA-256.
const BYTES_TOKEN = 32;

export interface TokenOpaco {
  /** Lo que viaja en la cookie httpOnly: 43 caracteres base64url. Nunca se registra en logs. */
  token: string;
  /** Lo único que se guarda en la base (BINARY(32)). */
  hash: Buffer;
}

/** Token opaco de una cookie httpOnly: el refresh token (A-07) y el carrito de invitado (N-05). */
export function generarTokenOpaco(): TokenOpaco {
  const token = randomBytes(BYTES_TOKEN).toString('base64url');
  return { token, hash: hashearTokenOpaco(token) };
}

export function hashearTokenOpaco(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}
