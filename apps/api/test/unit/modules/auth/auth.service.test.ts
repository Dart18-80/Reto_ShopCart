import { pino } from 'pino';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { hashearContrasena } from '../../../../src/modules/auth/auth.contrasenas.js';
import type { AuthRepository } from '../../../../src/modules/auth/auth.repository.js';
import { crearAuthService } from '../../../../src/modules/auth/auth.service.js';
import type { Credenciales } from '../../../../src/modules/auth/auth.types.js';
import {
  asignarCarritoDeInvitado,
  fusionarCarritoDeInvitado,
} from '../../../../src/modules/carrito/index.js';
import {
  crearTokensAcceso,
  ejecutarConContexto,
  obtenerContexto,
} from '../../../../src/shared/http/index.js';

// El servicio usa el carrito por su index.ts: aquí se reemplaza para probar la política de N-05.
vi.mock('../../../../src/modules/carrito/index.js', () => ({
  fusionarCarritoDeInvitado: vi.fn(),
  asignarCarritoDeInvitado: vi.fn(),
}));

const tokens = crearTokensAcceso(
  'secreto-de-prueba-de-al-menos-32-caracteres',
  pino({ level: 'silent' }),
);
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
    versionSesion: 2,
    ...cambios,
  };
}

function repositorioFalso(guardadas: Credenciales | null) {
  const repositorio = {
    obtenerCredenciales: vi.fn<AuthRepository['obtenerCredenciales']>(() =>
      Promise.resolve(guardadas),
    ),
    registrarCliente: vi.fn<AuthRepository['registrarCliente']>((datos) =>
      Promise.resolve({
        idUsuario: 9,
        correo: datos.correo,
        nombre: datos.nombre,
        rol: 'Cliente',
        versionSesion: 0,
      }),
    ),
    registrarRefresh: vi.fn<AuthRepository['registrarRefresh']>(() => Promise.resolve()),
    rotarRefresh: vi.fn<AuthRepository['rotarRefresh']>(() =>
      Promise.resolve({
        idUsuario: 7,
        correo: 'ana@x.gt',
        nombre: 'Ana',
        rol: 'Cliente' as const,
        versionSesion: 3,
      }),
    ),
    revocarSesion: vi.fn<AuthRepository['revocarSesion']>(() => Promise.resolve()),
  };
  return {
    repositorio,
    servicio: crearAuthService({ repositorio, tokens, logger: pino({ level: 'silent' }) }),
  };
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

    const { sesion } = await servicio.iniciarSesion(
      { correo: 'ana@x.gt', contrasena: CONTRASENA },
      CLIENTE,
    );

    expect(await tokens.verificar(sesion.accessToken)).toEqual({
      idUsuario: 7,
      rol: 'Operador',
      versionSesion: 2,
    });
    expect(sesion.usuario).not.toHaveProperty('versionSesion');
    expect(sesion.expiraEn).toBe(15 * 60);
  });

  it('guarda solo el SHA-256 del refresh token, con 7 días de vigencia y la IP del cliente', async () => {
    const { servicio, repositorio } = repositorioFalso(await credenciales());

    const { sesion } = await servicio.iniciarSesion(
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

    const { sesion } = await servicio.registrar(
      { correo: 'nuevo@x.gt', contrasena: CONTRASENA, nombre: 'Nuevo' },
      CLIENTE,
    );

    expect(sesion.usuario).toMatchObject({ idUsuario: 9, rol: 'Cliente' });
    expect(await tokens.verificar(sesion.accessToken)).toEqual({
      idUsuario: 9,
      rol: 'Cliente',
      versionSesion: 0,
    });
  });
});

describe('refrescar (E2-H02, A-07)', () => {
  it('sin refresh token responde NO_AUTENTICADO sin tocar la base', async () => {
    const { servicio, repositorio } = repositorioFalso(null);

    await expect(servicio.refrescar(undefined, CLIENTE)).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
    });
    expect(repositorio.rotarRefresh).not.toHaveBeenCalled();
  });

  it('un token que la base no rota (vencido, revocado o desconocido) responde NO_AUTENTICADO', async () => {
    const { servicio, repositorio } = repositorioFalso(null);
    repositorio.rotarRefresh.mockResolvedValue(null);

    await expect(servicio.refrescar('token-viejo', CLIENTE)).rejects.toMatchObject({
      codigo: 'NO_AUTENTICADO',
    });
  });

  it('rota con el hash del token recibido y entrega un refresh nuevo y otro access token', async () => {
    const { servicio, repositorio } = repositorioFalso(null);

    const sesion = await servicio.refrescar('token-actual', CLIENTE);

    const rotacion = repositorio.rotarRefresh.mock.calls[0]?.[0];
    expect(rotacion?.hashActual).toEqual(createHash('sha256').update('token-actual').digest());
    expect(rotacion?.hashNuevo).toEqual(createHash('sha256').update(sesion.refreshToken).digest());
    expect(sesion.refreshToken).not.toBe('token-actual');
    expect(await tokens.verificar(sesion.accessToken)).toEqual({
      idUsuario: 7,
      rol: 'Cliente',
      versionSesion: 3,
    });
    expect(sesion.usuario).not.toHaveProperty('versionSesion');
  });
});

describe('cerrarSesion (E2-H02, A-07)', () => {
  it('revoca la familia del token con el motivo Logout', async () => {
    const { servicio, repositorio } = repositorioFalso(null);

    await servicio.cerrarSesion('token-actual');

    expect(repositorio.revocarSesion).toHaveBeenCalledWith(
      createHash('sha256').update('token-actual').digest(),
      'Logout',
    );
  });

  it('sin token no hace nada: el logout es idempotente', async () => {
    const { servicio, repositorio } = repositorioFalso(null);

    await servicio.cerrarSesion(undefined);

    expect(repositorio.revocarSesion).not.toHaveBeenCalled();
  });
});

describe('carrito de invitado al abrir sesión (E4-H03, N-05)', () => {
  const TOKEN_INVITADO = 'z'.repeat(43);
  const AJUSTE = {
    tipo: 'CantidadAjustada' as const,
    idVariante: 1,
    producto: 'Camiseta',
    cantidadSolicitada: 6,
    cantidadFinal: 5,
  };
  const enPeticion = <T>(accion: () => Promise<T>) =>
    ejecutarConContexto({ requestId: 'r-1', idUsuario: null, rol: null }, accion);
  const login = (servicio: ReturnType<typeof repositorioFalso>['servicio'], token?: string) =>
    enPeticion(() =>
      servicio.iniciarSesion({ correo: 'ana@x.gt', contrasena: CONTRASENA }, CLIENTE, token),
    );

  it('al iniciar sesión fusiona como el cliente (solo durante esa llamada) y consume la cookie', async () => {
    const { servicio } = repositorioFalso(await credenciales());
    let contextoDeLaFusion: unknown;
    vi.mocked(fusionarCarritoDeInvitado).mockImplementationOnce(() => {
      contextoDeLaFusion = obtenerContexto();
      return Promise.resolve([AJUSTE]);
    });

    const { carrito } = await login(servicio, TOKEN_INVITADO);

    expect(carrito).toEqual({ cookieConsumida: true, avisos: [AJUSTE] });
    expect(fusionarCarritoDeInvitado).toHaveBeenCalledWith(TOKEN_INVITADO);
    expect(contextoDeLaFusion).toMatchObject({ requestId: 'r-1', idUsuario: 7, rol: 'Cliente' });
  });

  it('si la fusión falla, la sesión se abre, la cookie se conserva y la respuesta avisa FusionPendiente', async () => {
    const { servicio } = repositorioFalso(await credenciales());
    vi.mocked(fusionarCarritoDeInvitado).mockRejectedValueOnce(new Error('deadlock simulado'));

    const { sesion, carrito } = await login(servicio, TOKEN_INVITADO);

    expect(sesion.accessToken.length).toBeGreaterThan(0);
    expect(carrito.cookieConsumida).toBe(false);
    expect(carrito.avisos).toMatchObject([{ tipo: 'FusionPendiente' }]);
  });

  it('sin cookie o con un rol distinto de Cliente no toca el carrito', async () => {
    vi.mocked(fusionarCarritoDeInvitado).mockClear();
    const cliente = repositorioFalso(await credenciales());
    const operador = repositorioFalso(await credenciales({ rol: 'Operador' }));

    const sinCookie = await login(cliente.servicio);
    const conOtroRol = await login(operador.servicio, TOKEN_INVITADO);

    expect([sinCookie.carrito, conOtroRol.carrito]).toEqual([
      { cookieConsumida: false, avisos: [] },
      { cookieConsumida: false, avisos: [] },
    ]);
    expect(fusionarCarritoDeInvitado).not.toHaveBeenCalled();
  });

  it('al registrarse asigna el carrito; si falla, también avisa FusionPendiente', async () => {
    const registro = { correo: 'nuevo@x.gt', contrasena: CONTRASENA, nombre: 'Nuevo' };
    vi.mocked(asignarCarritoDeInvitado)
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('índice único'));

    const asignado = await enPeticion(() =>
      repositorioFalso(null).servicio.registrar(registro, CLIENTE, TOKEN_INVITADO),
    );
    const fallido = await enPeticion(() =>
      repositorioFalso(null).servicio.registrar(registro, CLIENTE, TOKEN_INVITADO),
    );

    expect(asignado.carrito).toEqual({ cookieConsumida: true, avisos: [] });
    expect(fallido.carrito).toMatchObject({
      cookieConsumida: false,
      avisos: [{ tipo: 'FusionPendiente' }],
    });
  });
});
