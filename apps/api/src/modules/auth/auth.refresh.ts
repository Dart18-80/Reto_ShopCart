import { createHash, randomBytes } from 'node:crypto';

// A-07: 256 bits aleatorios; en la base solo se guarda su SHA-256.
const BYTES_REFRESH = 32;
export const DIAS_VIGENCIA_REFRESH = 7;

export interface RefreshNuevo {
  token: string;
  hash: Buffer;
}

export function generarRefresh(): RefreshNuevo {
  const token = randomBytes(BYTES_REFRESH).toString('base64url');
  return { token, hash: hashearRefresh(token) };
}

export function hashearRefresh(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}
