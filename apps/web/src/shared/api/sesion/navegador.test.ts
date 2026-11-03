import { afterEach, describe, expect, it, vi } from 'vitest';
import { sesionDePrueba } from '../../../test/sesion';
import { crearBloqueoDelNavegador, crearCanalDelNavegador } from './navegador';
import { crearSesion, type MensajeSesion } from './sesion';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('bloqueo del navegador', () => {
  it('con Web Locks, la tarea corre dentro del lock shopcart-refresh', async () => {
    const request = vi.fn((_nombre: string, tarea: () => Promise<string>) => tarea());
    vi.stubGlobal('navigator', { locks: { request } });

    const resultado = await crearBloqueoDelNavegador().exclusivo(() => Promise.resolve('hecho'));

    expect(resultado).toBe('hecho');
    expect(request).toHaveBeenCalledWith('shopcart-refresh', expect.any(Function));
  });

  it('sin contexto seguro (navigator.locks no existe), el respaldo serializa las tareas en la pestaña', async () => {
    vi.stubGlobal('navigator', {});
    const bloqueo = crearBloqueoDelNavegador();
    const orden: string[] = [];
    const tarea = (nombre: string) => async () => {
      orden.push(`empieza ${nombre}`);
      await new Promise((resolver) => setTimeout(resolver, 0));
      orden.push(`termina ${nombre}`);
    };

    await Promise.all([bloqueo.exclusivo(tarea('a')), bloqueo.exclusivo(tarea('b'))]);

    expect(orden).toEqual(['empieza a', 'termina a', 'empieza b', 'termina b']);
  });

  it('el respaldo sigue con la siguiente tarea aunque una falle', async () => {
    vi.stubGlobal('navigator', {});
    const bloqueo = crearBloqueoDelNavegador();

    const fallida = bloqueo.exclusivo(() => Promise.reject(new Error('falló')));
    const siguiente = bloqueo.exclusivo(() => Promise.resolve('siguió'));

    await expect(fallida).rejects.toThrow('falló');
    await expect(siguiente).resolves.toBe('siguió');
  });

  it('sin navigator.locks la sesión funciona y renueva', async () => {
    vi.stubGlobal('navigator', {});
    const refrescar = vi.fn(() => Promise.resolve(sesionDePrueba('token-nuevo')));
    const sesion = crearSesion({
      refrescar,
      cerrarEnServidor: () => Promise.resolve(),
      bloqueo: crearBloqueoDelNavegador(),
      canal: crearCanalDelNavegador(),
    });
    sesion.establecer(sesionDePrueba('token-viejo'));

    const tokens = await Promise.all([
      sesion.renovar('token-viejo'),
      sesion.renovar('token-viejo'),
    ]);

    expect(tokens).toEqual(['token-nuevo', 'token-nuevo']);
    expect(refrescar).toHaveBeenCalledTimes(1);
  });
});

describe('canal del navegador', () => {
  it('lo que publica una pestaña llega a las demás por BroadcastChannel shopcart-sesion', async () => {
    const emisor = crearCanalDelNavegador();
    const receptor = crearCanalDelNavegador();
    const recibido = new Promise<MensajeSesion>((resolver) => {
      receptor.alRecibir(resolver);
    });

    emisor.publicar({ tipo: 'cerrada' });

    await expect(recibido).resolves.toEqual({ tipo: 'cerrada' });
  });
});
