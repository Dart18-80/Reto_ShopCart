import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { hashearContrasena } from '../../../../src/modules/auth/auth.contrasenas.js';
import type { AuthRepository } from '../../../../src/modules/auth/auth.repository.js';
import { crearAuthService } from '../../../../src/modules/auth/auth.service.js';
import type { Credenciales } from '../../../../src/modules/auth/auth.types.js';
import { crearTokensAcceso } from '../../../../src/shared/http/index.js';

const tokens = crearTokensAcceso('secreto-de-prueba-de-al-menos-32-caracteres');
const CLIENTE = { ip: '203.0.113.7', userAgent: 'pruebas' };
const CONTRASENA = 'Correcta2026';

async function credenciales(cambios: Partial<Credenciales> = {}): Promise<Credenciales> {
  return {
    idUsuario: 7,
    correo: 'ana@shopcart.test',
    nombre: 'Ana',
    rol: 'Cliente',
    hashContrasena: await hashearContrasena(CONTRASENA),
    activo: true,
    ...cambios,
  };
}

function repositorioFalso(guardadas: Credenciales | null) {
  const repositorio = {
    obtenerCredenciales: vi.fn<AuthRepository['obtenerCredenciales']>(() =>
      Promise.resolve(guardadas),
    ),
    registrarCliente: vi.fn<AuthRepository['registrarCliente']>((datos) =>
      Promise.resolve({ idUsuario: 9, correo: datos.correo, nombre: datos.nombre, rol: 'Cliente' }),
    ),
    registrarRefresh: vi.fn<AuthRepository['registrarRefresh']>(() => Promise.resolve()),
  };
  return { repositorio, servicio: crearAuthService({ repositorio, tokens }) };
}

describe('iniciarSesion (E2-H01, N-15)', () => {
  it('un correo inexistente y una contraseña incorrecta dan el mismo error', async () => {
    const inexistente = repositorioFalso(null).servicio;
    const conOtraContrasena = repositorioFalso(await credenciales()).servicio;

    const errores = await Promise.all([
      inexistente
        .iniciarSesion({ correo: 'nadie@x.gt', contrasena: CONTRASENA }, CLIENTE)
        .catch((e: unknown) => e),
      conOtraContrasena
        .iniciarSesion({ correo: 'ana@x.gt', contrasena: 'Otra2026' }, CLIENTE)
        .catch((e: unknown) => e),
    ]);

    for (const error of errores) {
      expect(error).toMatchObject({ codigo: 'CREDENCIALES_INVALIDAS', status: 401 });
    }
    expect((errores[0] as Error).message).toBe((errores[1] as Error).message);
  });

  it('un usuario desactivado no inicia sesión aunque la contraseña sea correcta', async () => {
    const { servicio, repositorio } = repositorioFalso(await credenciales({ activo: false }));

    await expect(
      servicio.iniciarSesion({ correo: 'ana@x.gt', contrasena: CONTRASENA }, CLIENTE),
    ).rejects.toMatchObject({ codigo: 'USUARIO_INACTIVO' });
    expect(repositorio.registrarRefresh).not.toHaveBeenCalled();
  });

  it('con credenciales válidas emite un access token con sub, rol y jti verificable', async () => {
    const { servicio } = repositorioFalso(await credenciales({ rol: 'Operador' }));

    const sesion = await servicio.iniciarSesion(
      { correo: 'ana@x.gt', contrasena: CONTRASENA },
      CLIENTE,
    );

    expect(await tokens.verificar(sesion.accessToken)).toEqual({ idUsuario: 7, rol: 'Operador' });
    expect(sesion.expiraEn).toBe(15 * 60);
  });

  it('guarda solo el SHA-256 del refresh token, con 7 días de vigencia y la IP del cliente', async () => {
    const { servicio, repositorio } = repositorioFalso(await credenciales());

    const sesion = await servicio.iniciarSesion(
      { correo: 'ana@x.gt', contrasena: CONTRASENA },
      CLIENTE,
    );

    const guardado = repositorio.registrarRefresh.mock.calls[0]?.[0];
    expect(guardado?.hash).toEqual(createHash('sha256').update(sesion.refreshToken).digest());
    expect(guardado).toMatchObject({ idUsuario: 7, diasVigencia: 7, ip: CLIENTE.ip });
    expect(JSON.stringify(guardado)).not.toContain(sesion.refreshToken);
  });
});

describe('registrar (E2-H01, N-15)', () => {
  it('guarda un hash argon2id y nunca la contraseña', async () => {
    const { servicio, repositorio } = repositorioFalso(null);

    await servicio.registrar(
      { correo: 'nuevo@x.gt', contrasena: CONTRASENA, nombre: 'Nuevo' },
      CLIENTE,
    );

    const datos = repositorio.registrarCliente.mock.calls[0]?.[0];
    // §10: argon2id con 19 MiB (19456 KiB), 2 iteraciones y 1 hilo.
    expect(datos?.hashContrasena).toMatch(/^\$argon2id\$v=19\$/);
    expect(datos?.hashContrasena).toMatch(/m=19456/);
    expect(datos?.hashContrasena).toMatch(/t=2/);
    expect(datos?.hashContrasena).toMatch(/p=1/);
    expect(JSON.stringify(datos)).not.toContain(CONTRASENA);
    expect(datos?.telefono).toBeNull();
  });

  it('abre la sesión del nuevo cliente', async () => {
    const { servicio } = repositorioFalso(null);

    const sesion = await servicio.registrar(
      { correo: 'nuevo@x.gt', contrasena: CONTRASENA, nombre: 'Nuevo' },
      CLIENTE,
    );

    expect(sesion.usuario).toMatchObject({ idUsuario: 9, rol: 'Cliente' });
    expect(await tokens.verificar(sesion.accessToken)).toEqual({ idUsuario: 9, rol: 'Cliente' });
  });
});
