import { describe, expect, it } from 'vitest';
import { crearLimiteDeConcurrencia } from '../../../../src/modules/auth/auth.concurrencia.js';

/** Una tarea que no termina hasta que la prueba la resuelve o la rechaza. */
function tareaControlada() {
  let resolver!: () => void;
  let rechazar!: (error: Error) => void;
  const promesa = new Promise<void>((resolve, reject) => {
    resolver = resolve;
    rechazar = reject;
  });
  return { tarea: () => promesa, resolver, rechazar };
}

// Deja correr las continuaciones pendientes (cada permiso se entrega en una microtarea).
const procesar = () => new Promise((resolver) => setTimeout(resolver, 0));

describe('crearLimiteDeConcurrencia (argon2 y el threadpool de libuv)', () => {
  it('nunca corren más de N a la vez; el que espera entra cuando uno termina, en orden de llegada', async () => {
    const limitar = crearLimiteDeConcurrencia(2);
    const tareas = [tareaControlada(), tareaControlada(), tareaControlada()];
    const empezadas: number[] = [];

    const resultados = tareas.map(({ tarea }, indice) =>
      limitar(() => {
        empezadas.push(indice);
        return tarea();
      }),
    );
    await procesar();
    expect(empezadas).toEqual([0, 1]);

    tareas[1]?.resolver();
    await procesar();
    expect(empezadas).toEqual([0, 1, 2]);

    tareas[0]?.resolver();
    tareas[2]?.resolver();
    await Promise.all(resultados);
  });

  it('una tarea que falla libera su permiso y el error llega a quien la pidió', async () => {
    const limitar = crearLimiteDeConcurrencia(1);
    const falla = tareaControlada();
    const siguiente = tareaControlada();
    let empezoLaSiguiente = false;

    const primera = limitar(falla.tarea);
    const segunda = limitar(() => {
      empezoLaSiguiente = true;
      return siguiente.tarea();
    });
    await procesar();
    expect(empezoLaSiguiente).toBe(false);

    falla.rechazar(new Error('argon2 falló'));
    await expect(primera).rejects.toThrow('argon2 falló');
    await procesar();
    expect(empezoLaSiguiente).toBe(true);

    siguiente.resolver();
    await segunda;
  });

  it('una tarea que lanza al empezar (sin promesa) también libera su permiso', async () => {
    const limitar = crearLimiteDeConcurrencia(1);

    await expect(
      limitar(() => {
        throw new Error('parámetros inválidos');
      }),
    ).rejects.toThrow('parámetros inválidos');

    await expect(limitar(() => Promise.resolve('siguió'))).resolves.toBe('siguió');
  });
});
