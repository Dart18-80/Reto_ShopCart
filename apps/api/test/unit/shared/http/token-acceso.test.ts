import { Writable } from 'node:stream';
import { SignJWT } from 'jose';
import { pino } from 'pino';
import { describe, expect, it } from 'vitest';
import { crearTokensAcceso } from '../../../../src/shared/http/index.js';

const SECRETO = 'secreto-de-prueba-de-al-menos-32-caracteres';
const OTRO_SECRETO = 'otro-secreto-de-otra-replica-de-32-caracteres';
const ACTOR = { idUsuario: 7, rol: 'Cliente' as const, versionSesion: 0 };

interface LineaLog {
  level: number;
  codigo?: string;
}

function tokensConLog(secreto = SECRETO) {
  const lineas: string[] = [];
  const destino = new Writable({
    write(fragmento: Buffer, _codificacion, listo) {
      lineas.push(fragmento.toString());
      listo();
    },
  });
  const tokens = crearTokensAcceso(secreto, pino({ level: 'debug' }, destino));
  const leidas = () => lineas.map((linea) => JSON.parse(linea) as LineaLog);
  return { tokens, lineas, leidas };
}

const NIVEL_DEBUG = 20;
const NIVEL_WARN = 40;

describe('verificar registra el motivo del rechazo, nunca el token (A-07)', () => {
  it('una firma de otro secreto (por ejemplo, JWT_SECRETO distinto entre réplicas) se registra en warn', async () => {
    const token = await crearTokensAcceso(OTRO_SECRETO, pino({ level: 'silent' })).emitir(ACTOR);
    const { tokens, lineas, leidas } = tokensConLog();

    expect(await tokens.verificar(token)).toBeNull();

    expect(leidas()).toEqual([
      expect.objectContaining({
        level: NIVEL_WARN,
        codigo: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
      }),
    ]);
    expect(lineas.join('')).not.toContain(token);
  });

  it('un token vencido es una expiración normal: solo debug', async () => {
    const vencido = await new SignJWT({ rol: 'Cliente', versionSesion: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('7')
      .setJti('jti')
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1)
      .sign(new TextEncoder().encode(SECRETO));
    const { tokens, leidas } = tokensConLog();

    expect(await tokens.verificar(vencido)).toBeNull();

    expect(leidas()).toEqual([
      expect.objectContaining({ level: NIVEL_DEBUG, codigo: 'ERR_JWT_EXPIRED' }),
    ]);
  });

  it('una firma válida con una carga que no cumple el esquema se registra en warn', async () => {
    const conRolSistema = await new SignJWT({ rol: 'Sistema', versionSesion: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('7')
      .setJti('jti')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(SECRETO));
    const { tokens, lineas, leidas } = tokensConLog();

    expect(await tokens.verificar(conRolSistema)).toBeNull();

    expect(leidas()).toEqual([
      expect.objectContaining({ level: NIVEL_WARN, codigo: 'CARGA_INVALIDA' }),
    ]);
    expect(lineas.join('')).not.toContain(conRolSistema);
  });

  it('un texto que no es JWT se registra en warn con el código de jose', async () => {
    const { tokens, leidas } = tokensConLog();

    expect(await tokens.verificar('no-es-un-jwt')).toBeNull();

    expect(leidas()).toEqual([
      expect.objectContaining({ level: NIVEL_WARN, codigo: 'ERR_JWS_INVALID' }),
    ]);
  });

  it('un token válido no deja nada en el log', async () => {
    const { tokens, lineas } = tokensConLog();

    expect(await tokens.verificar(await tokens.emitir(ACTOR))).toEqual(ACTOR);

    expect(lineas).toEqual([]);
  });
});
