import { randomUUID } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { authRepository } from '../../../src/modules/auth/auth.repository.js';
import { usuariosRepository } from '../../../src/modules/usuarios/usuarios.repository.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoActor } from '../datos-de-prueba.js';

usarBaseDePruebas();

// Corre en el grupo secuencial (vitest.integracion.config.ts): deja exactamente dos Admins activos, algo
// que ninguna otra prueba puede ver mientras tanto, y al terminar deja los Admins como los encontró.
const TAMANO_PAGINA = 100;
const HASH_SIN_USO = 'sin-login-en-esta-prueba';
const PARES_CRUZADOS = 5;

let idAdminSemilla: number;
let adminsIniciales: number[];

const comoAdmin = <T>(idAdmin: number, accion: () => Promise<T>) =>
  comoActor(idAdmin, 'Administrador', accion);

async function adminsActivos(): Promise<number[]> {
  const ids: number[] = [];
  for (let pagina = 1; ; pagina++) {
    const { usuarios } = await comoAdmin(idAdminSemilla, () =>
      usuariosRepository.listar({
        pagina,
        tamano: TAMANO_PAGINA,
        rol: 'Administrador',
        activo: true,
      }),
    );
    ids.push(...usuarios.map((usuario) => usuario.idUsuario));
    if (usuarios.length < TAMANO_PAGINA) return ids.sort((a, b) => a - b);
  }
}

async function crearAdmin(): Promise<number> {
  const { idUsuario } = await comoAdmin(idAdminSemilla, () =>
    usuariosRepository.crearInterno({
      correo: `admin-${randomUUID()}@shopcart.test`,
      hashContrasena: HASH_SIN_USO,
      nombre: 'Admin de la carrera',
      telefono: null,
      rol: 'Administrador',
    }),
  );
  return idUsuario;
}

/** Deja activos solo a A y B: desactiva a todos los demás Admins, actuando como A. */
async function dejarSolo(a: number, b: number): Promise<void> {
  for (const id of await adminsActivos()) {
    if (id !== a && id !== b) await comoAdmin(a, () => usuariosRepository.cambiarEstado(id, false));
  }
}

const acciones = {
  desactivar: (actor: number, objetivo: number) =>
    comoAdmin(actor, () => usuariosRepository.cambiarEstado(objetivo, false)),
  quitarRol: (actor: number, objetivo: number) =>
    comoAdmin(actor, () => usuariosRepository.actualizar(objetivo, null, 'Operador')),
};

beforeAll(async () => {
  const semilla = await authRepository.obtenerCredenciales('admin@shopcart.gt');
  if (semilla === null) throw new Error('Falta el Admin semilla');
  idAdminSemilla = semilla.idUsuario;
  adminsIniciales = await adminsActivos();
});

// Restaura aunque la prueba falle: el superviviente reactiva a los Admins iniciales y la semilla
// desactiva a los Admins de la carrera que sigan activos.
afterEach(async () => {
  const [superviviente] = await adminsActivos();
  if (superviviente === undefined) throw new Error('La prueba dejó el sistema sin Admins activos');
  for (const id of adminsIniciales) {
    await comoAdmin(superviviente, () => usuariosRepository.cambiarEstado(id, true));
  }
  for (const id of await adminsActivos()) {
    if (!adminsIniciales.includes(id)) {
      await comoAdmin(idAdminSemilla, () => usuariosRepository.cambiarEstado(id, false));
    }
  }
});

describe('N-15: Admins activos con operaciones en paralelo', () => {
  it.each(['desactivar', 'quitarRol'] as const)(
    'A desactiva a B mientras B hace "%s" sobre A: uno gana y el otro recibe ULTIMO_ADMIN',
    async (accionDeB) => {
      const [a, b] = [await crearAdmin(), await crearAdmin()];
      await dejarSolo(a, b);
      expect(await adminsActivos()).toEqual([a, b].sort((x, y) => x - y));

      const resultados = await Promise.allSettled([
        acciones.desactivar(a, b),
        acciones[accionDeB](b, a),
      ]);

      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const [rechazo] = resultados.filter((r) => r.status === 'rejected');
      expect(rechazo?.reason).toMatchObject({ codigo: 'ULTIMO_ADMIN', status: 409 });
      expect(await adminsActivos()).toHaveLength(1);
    },
  );

  // Cada SP bloquea la fila del rol Administrador antes que la fila objetivo; sin ese orden, los pares
  // cruzados se bloqueaban mutuamente y agotaban los reintentos por deadlock (500).
  it.each(['desactivar', 'quitarRol'] as const)(
    'con varios Admins, pares cruzados a la vez terminan bien, sin errores por deadlock',
    async (accionDeB) => {
      const pares = await Promise.all(
        Array.from({ length: PARES_CRUZADOS }, async () => ({
          a: await crearAdmin(),
          b: await crearAdmin(),
        })),
      );

      const resultados = await Promise.allSettled(
        pares.flatMap(({ a, b }) => [acciones.desactivar(a, b), acciones[accionDeB](b, a)]),
      );

      expect(resultados.filter((r) => r.status === 'rejected')).toEqual([]);
    },
  );

  it('deja los Admins activos como los encontró', async () => {
    expect(await adminsActivos()).toEqual(adminsIniciales);
  });
});
