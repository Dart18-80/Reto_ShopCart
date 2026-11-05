import { describe, expect, it, vi } from 'vitest';
import { crearCanalesEnMemoria, sesionDePrueba, usuarioDePrueba } from '../../../test/sesion';
import { ErrorApi } from '../ErrorApi';
import { crearBloqueoDeLaPestana } from './navegador';
import { crearSesion, type Bloqueo, type DatosSesion } from './sesion';

const errorApi = (status: number, codigo: string) =>
  new ErrorApi({ status, codigo, mensaje: codigo, detalles: undefined, requestId: 'req-1' });

/** Una promesa que la prueba resuelve cuando quiere: deja ver qué pasa mientras un refresh está en vuelo. */
function diferida<T>() {
  let resolverPromesa: (valor: T) => void = () => undefined;
  const promesa = new Promise<T>((resolver) => {
    resolverPromesa = resolver;
  });
  return {
    promesa,
    resolver: (valor: T) => {
      resolverPromesa(valor);
    },
  };
}

interface OpcionesPestana {
  refrescar?: () => Promise<DatosSesion>;
  cerrarEnServidor?: () => Promise<void>;
}

/** Pestañas del mismo navegador: comparten el bloqueo (Web Locks) y el canal (BroadcastChannel). */
function crearNavegador(bloqueo: Bloqueo = crearBloqueoDeLaPestana()) {
  const canal = crearCanalesEnMemoria();
  return function pestana({
    refrescar = vi.fn<() => Promise<DatosSesion>>(),
    cerrarEnServidor = vi.fn(() => Promise.resolve()),
  }: OpcionesPestana = {}) {
    return crearSesion({ refrescar, cerrarEnServidor, bloqueo, canal: canal() });
  };
}

/** Deja que lleguen los mensajes del canal, que se entregan en una microtarea. */
const entregarMensajes = () => new Promise((resolver) => setTimeout(resolver, 0));

describe('sesión: renovación dentro de la pestaña (single-flight)', () => {
  it('varias renovaciones a la vez piden el bloqueo y el refresh una sola vez, y todas reciben el token nuevo', async () => {
    const bloqueo = crearBloqueoDeLaPestana();
    const exclusivo = vi.spyOn(bloqueo, 'exclusivo');
    const refrescar = vi.fn(() => Promise.resolve(sesionDePrueba('token-nuevo')));
    const sesion = crearNavegador(bloqueo)({ refrescar });
    sesion.establecer(sesionDePrueba('token-viejo'));

    const tokens = await Promise.all([1, 2, 3, 4, 5].map(() => sesion.renovar('token-viejo')));

    expect(exclusivo).toHaveBeenCalledTimes(1);
    expect(refrescar).toHaveBeenCalledTimes(1);
    expect(tokens).toEqual(Array(5).fill('token-nuevo'));
  });

  it('un 401 con un token que ya se renovó no vuelve a renovar: usa el token vigente', async () => {
    const refrescar = vi.fn(() => Promise.resolve(sesionDePrueba('token-nuevo')));
    const sesion = crearNavegador()({ refrescar });
    sesion.establecer(sesionDePrueba('token-viejo'));
    await sesion.renovar('token-viejo');

    const token = await sesion.renovar('token-viejo');

    expect(token).toBe('token-nuevo');
    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it('sin sesión no renueva: un invitado con 401 no llama al refresh', async () => {
    const refrescar = vi.fn<() => Promise<DatosSesion>>();
    const sesion = crearNavegador()({ refrescar });

    const token = await sesion.renovar(null);

    expect(token).toBeNull();
    expect(refrescar).not.toHaveBeenCalled();
  });

  it('una petición que salió sin sesión no renueva aunque ahora haya sesión: no se reenvía como otra identidad', async () => {
    const refrescar = vi.fn<() => Promise<DatosSesion>>();
    const sesion = crearNavegador()({ refrescar });
    sesion.establecer(sesionDePrueba('token-de-ana'));

    const token = await sesion.renovar(null);

    expect(token).toBeNull();
    expect(refrescar).not.toHaveBeenCalled();
  });

  it('cerrar la sesión mientras una renovación está en vuelo no se revierte cuando el refresh termina', async () => {
    const refresh = diferida<DatosSesion>();
    const pestana = crearNavegador();
    const a = pestana({ refrescar: () => refresh.promesa });
    const b = pestana();
    a.establecer(sesionDePrueba('token-viejo'));
    await entregarMensajes();

    const renovacion = a.renovar('token-viejo');
    await entregarMensajes();
    await a.cerrar();
    refresh.resolver(sesionDePrueba('token-nuevo'));
    await renovacion;
    await entregarMensajes();

    expect(a.estado()).toEqual({ tipo: 'invitado' });
    expect(a.token()).toBeNull();
    expect(b.estado()).toEqual({ tipo: 'invitado' });
  });

  it('si otra pestaña cierra la sesión mientras esta renueva, el refresh que llega tarde no la reabre', async () => {
    const refresh = diferida<DatosSesion>();
    const pestana = crearNavegador(crearBloqueoDeLaPestana());
    const a = pestana({ refrescar: () => refresh.promesa });
    const b = pestana();
    a.establecer(sesionDePrueba('token-viejo'));
    await entregarMensajes();

    const renovacion = a.renovar('token-viejo');
    await entregarMensajes();
    await b.cerrar();
    await entregarMensajes();
    refresh.resolver(sesionDePrueba('token-nuevo'));

    expect(await renovacion).toBeNull();
    expect(a.estado()).toEqual({ tipo: 'invitado' });
  });

  it('una falla de red o un 5xx del refresh no cierra la sesión: el error llega al llamador', async () => {
    const sesion = crearNavegador()({ refrescar: () => Promise.reject(ErrorApi.deRed()) });
    sesion.establecer(sesionDePrueba('token-viejo'));

    await expect(sesion.renovar('token-viejo')).rejects.toMatchObject({ codigo: 'RED' });

    expect(sesion.estado()).toMatchObject({ tipo: 'activa' });
    expect(sesion.token()).toBe('token-viejo');
  });
});

describe('sesión: renovación entre pestañas (Web Locks + BroadcastChannel)', () => {
  it('dos pestañas que renuevan a la vez hacen un solo refresh y la segunda usa el token de la primera', async () => {
    const pestana = crearNavegador();
    const refrescar = vi.fn(() => Promise.resolve(sesionDePrueba('token-nuevo')));
    const a = pestana({ refrescar });
    const b = pestana({ refrescar });
    a.establecer(sesionDePrueba('token-viejo'));
    await entregarMensajes();
    expect(b.token()).toBe('token-viejo');

    const [tokenA, tokenB] = await Promise.all([
      a.renovar('token-viejo'),
      b.renovar('token-viejo'),
    ]);

    expect(refrescar).toHaveBeenCalledTimes(1);
    expect(tokenA).toBe('token-nuevo');
    expect(tokenB).toBe('token-nuevo');
  });

  it('la pestaña que esperaba el bloqueo no renueva si otra cerró la sesión mientras tanto', async () => {
    const pestana = crearNavegador();
    const refrescar = vi.fn(() => Promise.reject(errorApi(401, 'REFRESH_REUTILIZADO')));
    const a = pestana({ refrescar });
    const b = pestana({ refrescar });
    a.establecer(sesionDePrueba('token-viejo'));
    await entregarMensajes();

    const [tokenA, tokenB] = await Promise.all([
      a.renovar('token-viejo'),
      b.renovar('token-viejo'),
    ]);

    expect(refrescar).toHaveBeenCalledTimes(1);
    expect([tokenA, tokenB]).toEqual([null, null]);
  });

  it.each(['REFRESH_REUTILIZADO', 'USUARIO_INACTIVO', 'NO_AUTENTICADO'])(
    'un refresh rechazado con %s cierra la sesión en todas las pestañas',
    async (codigo) => {
      const pestana = crearNavegador();
      const a = pestana({ refrescar: () => Promise.reject(errorApi(401, codigo)) });
      const b = pestana();
      a.establecer(sesionDePrueba('token-viejo'));
      await entregarMensajes();

      const token = await a.renovar('token-viejo');
      await entregarMensajes();

      expect(token).toBeNull();
      expect(a.estado()).toEqual({ tipo: 'invitado' });
      expect(b.estado()).toEqual({ tipo: 'invitado' });
      expect(b.token()).toBeNull();
    },
  );

  it('el inicio de sesión en una pestaña se propaga a las demás', async () => {
    const pestana = crearNavegador();
    const a = pestana();
    const b = pestana();

    a.establecer(sesionDePrueba('token-de-ana'));
    await entregarMensajes();

    expect(b.token()).toBe('token-de-ana');
    expect(b.estado()).toEqual({ tipo: 'activa', usuario: usuarioDePrueba('Cliente') });
  });

  it('cerrar avisa al servidor y cierra la sesión en todas las pestañas', async () => {
    const pestana = crearNavegador();
    const cerrarEnServidor = vi.fn(() => Promise.resolve());
    const a = pestana({ cerrarEnServidor });
    const b = pestana();
    a.establecer(sesionDePrueba('token-de-ana'));
    await entregarMensajes();

    await a.cerrar();
    await entregarMensajes();

    expect(cerrarEnServidor).toHaveBeenCalledTimes(1);
    expect(a.estado()).toEqual({ tipo: 'invitado' });
    expect(b.estado()).toEqual({ tipo: 'invitado' });
  });

  it('si el logout falla por red, la sesión local se cierra igual y el error llega al llamador', async () => {
    const pestana = crearNavegador();
    const a = pestana({ cerrarEnServidor: () => Promise.reject(ErrorApi.deRed()) });
    const b = pestana();
    a.establecer(sesionDePrueba('token-de-ana'));
    await entregarMensajes();

    await expect(a.cerrar()).rejects.toMatchObject({ codigo: 'RED' });
    await entregarMensajes();

    expect(a.token()).toBeNull();
    expect(b.estado()).toEqual({ tipo: 'invitado' });
  });
});

describe('sesión: rehidratación al cargar', () => {
  it('mientras rehidrata, el estado es rehidratando; con la cookie vigente queda activa', async () => {
    const refresh = diferida<DatosSesion>();
    const sesion = crearNavegador()({ refrescar: () => refresh.promesa });

    const rehidratacion = sesion.rehidratar();
    expect(sesion.estado()).toEqual({ tipo: 'rehidratando' });

    refresh.resolver(sesionDePrueba('token-rehidratado', 'Operador'));
    await rehidratacion;

    expect(sesion.estado()).toEqual({ tipo: 'activa', usuario: usuarioDePrueba('Operador') });
    expect(sesion.token()).toBe('token-rehidratado');
  });

  it('sin cookie (401) queda como invitado', async () => {
    const sesion = crearNavegador()({
      refrescar: () => Promise.reject(errorApi(401, 'NO_AUTENTICADO')),
    });

    await sesion.rehidratar();

    expect(sesion.estado()).toEqual({ tipo: 'invitado' });
  });

  it.each([
    ['una falla de red', ErrorApi.deRed()],
    ['un 503', errorApi(503, 'RESPUESTA_INESPERADA')],
  ])('con %s queda no verificada con el error, y reintentar la verifica', async (_caso, error) => {
    const refrescar = vi
      .fn<() => Promise<DatosSesion>>()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(sesionDePrueba('token-rehidratado'));
    const sesion = crearNavegador()({ refrescar });

    await sesion.rehidratar();
    expect(sesion.estado()).toEqual({ tipo: 'noVerificada', error });

    await sesion.rehidratar();
    expect(sesion.estado()).toMatchObject({ tipo: 'activa' });
  });

  it('una falla que no es ErrorApi deja la sesión no verificada (nunca trabada en rehidratando)', async () => {
    const sesion = crearNavegador()({
      refrescar: () => Promise.reject(new Error('2xx sin cuerpo')),
    });

    await expect(sesion.rehidratar()).resolves.toBeUndefined();

    expect(sesion.estado()).toMatchObject({
      tipo: 'noVerificada',
      error: { codigo: 'RESPUESTA_INESPERADA' },
    });
    await expect(sesion.esperarRehidratacion()).resolves.toBeUndefined();
  });

  it('rehidratar dos veces seguidas hace un solo refresh', async () => {
    const refrescar = vi.fn(() => Promise.resolve(sesionDePrueba('token-rehidratado')));
    const sesion = crearNavegador()({ refrescar });

    await Promise.all([sesion.rehidratar(), sesion.rehidratar()]);

    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it('esperarRehidratacion termina cuando termina la rehidratación', async () => {
    const refresh = diferida<DatosSesion>();
    const sesion = crearNavegador()({ refrescar: () => refresh.promesa });
    void sesion.rehidratar();
    let termino = false;

    const espera = sesion.esperarRehidratacion().then(() => {
      termino = true;
    });
    await entregarMensajes();
    expect(termino).toBe(false);

    refresh.resolver(sesionDePrueba('token-rehidratado'));
    await espera;
    expect(sesion.token()).toBe('token-rehidratado');
  });
});

describe('sesión: aviso de cambio de usuario (para vaciar la caché)', () => {
  it('avisa al iniciar sesión, al cambiar de usuario y al cerrar', async () => {
    const sesion = crearNavegador()();
    const reaccion = vi.fn();
    sesion.alCambiarUsuario(reaccion);

    sesion.establecer(sesionDePrueba('token-de-ana', 'Cliente'));
    sesion.establecer(sesionDePrueba('token-de-luis', 'Operador'));
    await sesion.cerrar();

    expect(reaccion).toHaveBeenCalledTimes(3);
  });

  it('al verificar una sesión que no se pudo verificar, avisa el cambio de usuario (la caché tiene datos de invitado)', async () => {
    const refrescar = vi
      .fn<() => Promise<DatosSesion>>()
      .mockRejectedValueOnce(ErrorApi.deRed())
      .mockResolvedValueOnce(sesionDePrueba('token-rehidratado'));
    const sesion = crearNavegador()({ refrescar });
    const reaccion = vi.fn();
    sesion.alCambiarUsuario(reaccion);

    await sesion.rehidratar();
    await sesion.rehidratar();

    expect(sesion.estado()).toMatchObject({ tipo: 'activa' });
    expect(reaccion).toHaveBeenCalledTimes(1);
  });

  it('no avisa al renovar el token del mismo usuario', async () => {
    const sesion = crearNavegador()({
      refrescar: () => Promise.resolve(sesionDePrueba('token-nuevo')),
    });
    sesion.establecer(sesionDePrueba('token-viejo'));
    const reaccion = vi.fn();
    sesion.alCambiarUsuario(reaccion);

    await sesion.renovar('token-viejo');

    expect(reaccion).not.toHaveBeenCalled();
  });

  it('no avisa al terminar la rehidratación: las peticiones la esperan, así que no hay caché de otra identidad', async () => {
    const sesion = crearNavegador()({
      refrescar: () => Promise.resolve(sesionDePrueba('token-rehidratado')),
    });
    const reaccion = vi.fn();
    sesion.alCambiarUsuario(reaccion);

    await sesion.rehidratar();

    expect(reaccion).not.toHaveBeenCalled();
  });

  it('suscribir avisa de cada cambio de estado y se puede cancelar', () => {
    const sesion = crearNavegador()();
    const avisar = vi.fn();
    const cancelar = sesion.suscribir(avisar);

    sesion.establecer(sesionDePrueba('token-de-ana'));
    cancelar();
    sesion.olvidar();

    expect(avisar).toHaveBeenCalledTimes(1);
  });
});

describe('sesión: un refresh que falla tarde no pisa una sesión más nueva', () => {
  it('si otra pestaña inició sesión mientras esta rehidrataba, una falla de red tardía no la deja no verificada', async () => {
    let fallar: (error: unknown) => void = () => undefined;
    const pestana = crearNavegador();
    const a = pestana({
      refrescar: () =>
        new Promise<DatosSesion>((_resolver, rechazar) => {
          fallar = rechazar;
        }),
    });
    const b = pestana();

    const rehidratacion = a.rehidratar();
    await entregarMensajes();
    b.establecer(sesionDePrueba('token-de-b'));
    await entregarMensajes();
    fallar(ErrorApi.deRed());
    await rehidratacion;

    expect(a.estado()).toMatchObject({ tipo: 'activa' });
    expect(a.token()).toBe('token-de-b');
  });

  it('si inició sesión mientras el Reintentar estaba en vuelo, un 503 tardío no la deja trabada', async () => {
    const refrescar = vi.fn<() => Promise<DatosSesion>>().mockRejectedValueOnce(ErrorApi.deRed());
    const sesion = crearNavegador()({ refrescar });
    await sesion.rehidratar();
    expect(sesion.estado()).toMatchObject({ tipo: 'noVerificada' });

    let fallar: (error: unknown) => void = () => undefined;
    refrescar.mockImplementationOnce(
      () =>
        new Promise<DatosSesion>((_resolver, rechazar) => {
          fallar = rechazar;
        }),
    );
    const reintento = sesion.rehidratar();
    await entregarMensajes();
    sesion.establecer(sesionDePrueba('token-del-login'));
    fallar(errorApi(503, 'RESPUESTA_INESPERADA'));
    await reintento;

    expect(sesion.estado()).toMatchObject({ tipo: 'activa' });
    expect(sesion.token()).toBe('token-del-login');
  });

  it('un 401 tardío del refresh no cierra la sesión que otra pestaña abrió mientras tanto', async () => {
    let fallar: (error: unknown) => void = () => undefined;
    const pestana = crearNavegador();
    const a = pestana({
      refrescar: () =>
        new Promise<DatosSesion>((_resolver, rechazar) => {
          fallar = rechazar;
        }),
    });
    const b = pestana();
    a.establecer(sesionDePrueba('token-viejo'));
    await entregarMensajes();

    const renovacion = a.renovar('token-viejo');
    await entregarMensajes();
    b.establecer(sesionDePrueba('token-de-b', 'Operador'));
    await entregarMensajes();
    fallar(errorApi(401, 'REFRESH_REUTILIZADO'));
    await renovacion;
    await entregarMensajes();

    expect(a.estado()).toMatchObject({ tipo: 'activa' });
    expect(a.token()).toBe('token-de-b');
    expect(b.estado()).toMatchObject({ tipo: 'activa' });
  });
});
