import { Writable } from 'node:stream';
import { SignJWT } from 'jose';
import { pino } from 'pino';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  aRolDeUsuario,
  crearTokensAcceso,
  VIGENCIA_ACCESO_SEG,
  type ActorDelToken,
} from '../../../../src/shared/http/index.js';

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

    expect(await tokens.verificar(await tokens.emitir(ACTOR))).toMatchObject(ACTOR);

    expect(lineas).toEqual([]);
  });

  it('E9-H02: verificar devuelve cuándo vence el token (su exp), para cerrar a tiempo el stream del dashboard', async () => {
    const { tokens } = tokensConLog();
    const antes = Date.now();

    const verificado = await tokens.verificar(await tokens.emitir(ACTOR));

    const vence = verificado?.venceEn.getTime() ?? 0;
    expect(vence).toBeGreaterThanOrEqual(
      Math.floor(antes / 1000) * 1000 + VIGENCIA_ACCESO_SEG * 1000,
    );
    expect(vence).toBeLessThanOrEqual(Date.now() + VIGENCIA_ACCESO_SEG * 1000);
  });
});

describe('ningún token puede traer el rol Sistema (A-18)', () => {
  it('el tipo del rol del token solo admite roles de usuario', () => {
    expectTypeOf<'Sistema'>().not.toExtend<ActorDelToken['rol']>();
    expectTypeOf<'Cliente' | 'Operador' | 'Administrador'>().toExtend<ActorDelToken['rol']>();
  });

  it('un rol Sistema leído de la base es un error de datos, no un rol', () => {
    expect(() => aRolDeUsuario('Sistema')).toThrow(/Rol inesperado/);
    expect(aRolDeUsuario('Operador')).toBe('Operador');
  });
});
