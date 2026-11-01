import { describe, expect, it, vi } from 'vitest';
import { hashearContrasena, type Sesiones } from '../../../../src/modules/auth/index.js';
import type { UsuariosRepository } from '../../../../src/modules/usuarios/usuarios.repository.js';
import { crearUsuariosService } from '../../../../src/modules/usuarios/usuarios.service.js';
import type { PerfilConHash, Usuario } from '../../../../src/modules/usuarios/usuarios.types.js';
import type { ListaRevocados } from '../../../../src/shared/http/index.js';

const CONTRASENA = 'Actual2026';
const CLIENTE = { ip: '203.0.113.7', userAgent: 'pruebas' };

const USUARIO: Usuario = {
  idUsuario: 7,
  correo: 'ana@x.gt',
  nombre: 'Ana',
  telefono: '55554444',
  rol: 'Cliente',
  activo: true,
};

async function preparar() {
  const perfil: PerfilConHash = { ...USUARIO, hashContrasena: await hashearContrasena(CONTRASENA) };
  const repositorio = {
    obtenerPerfil: vi.fn(() => Promise.resolve(perfil)),
    actualizarPerfil: vi.fn((nombre: string, telefono: string | null) =>
      Promise.resolve({ ...USUARIO, nombre, telefono }),
    ),
    cambiarContrasena: vi.fn((_hash: string) => Promise.resolve()),
    listar: vi.fn(() => Promise.resolve({ usuarios: [USUARIO], total: 1 })),
    crearInterno: vi.fn(() => Promise.resolve(USUARIO)),
    actualizar: vi.fn(() => Promise.resolve(USUARIO)),
    cambiarEstado: vi.fn((_id: number, activo: boolean) => Promise.resolve({ ...USUARIO, activo })),
  } satisfies UsuariosRepository;
  const sesiones = {
    abrir: vi.fn<Sesiones['abrir']>((usuario) =>
      Promise.resolve({ accessToken: 'a', expiraEn: 900, refreshToken: 'r', usuario }),
    ),
  };
  const listaRevocados = {
    estaRevocado: vi.fn<ListaRevocados['estaRevocado']>(() => Promise.resolve(false)),
    revocar: vi.fn<ListaRevocados['revocar']>(() => Promise.resolve()),
    restaurar: vi.fn<ListaRevocados['restaurar']>(() => Promise.resolve()),
  };
  const servicio = crearUsuariosService({ repositorio, sesiones, listaRevocados });
  return { servicio, repositorio, sesiones, listaRevocados };
}

describe('usuarios.service (E2-H04, N-15)', () => {
  it('el perfil nunca expone el hash de la contraseña', async () => {
    const { servicio } = await preparar();

    const perfil = await servicio.obtenerPerfil();

    expect(perfil).toEqual(USUARIO);
    expect(perfil).not.toHaveProperty('hashContrasena');
  });

  it('PATCH del perfil conserva lo que no llega y quita el teléfono con null', async () => {
    const { servicio, repositorio } = await preparar();

    await servicio.actualizarPerfil({ nombre: 'Ana María' });
    await servicio.actualizarPerfil({ telefono: null });

    expect(repositorio.actualizarPerfil).toHaveBeenNthCalledWith(1, 'Ana María', '55554444');
    expect(repositorio.actualizarPerfil).toHaveBeenNthCalledWith(2, 'Ana', null);
  });

  it('con la contraseña actual incorrecta no cambia nada ni abre sesión', async () => {
    const { servicio, repositorio, sesiones } = await preparar();

    await expect(
      servicio.cambiarContrasena(
        { contrasenaActual: 'Otra2026', contrasenaNueva: 'Nueva2027' },
        CLIENTE,
      ),
    ).rejects.toMatchObject({ codigo: 'PARAMETRO_INVALIDO' });
    expect(repositorio.cambiarContrasena).not.toHaveBeenCalled();
    expect(sesiones.abrir).not.toHaveBeenCalled();
  });

  it('con la contraseña actual correcta guarda un hash nuevo y abre una sesión nueva', async () => {
    const { servicio, repositorio, sesiones } = await preparar();

    await servicio.cambiarContrasena(
      { contrasenaActual: CONTRASENA, contrasenaNueva: 'Nueva2027' },
      CLIENTE,
    );

    expect(repositorio.cambiarContrasena.mock.calls[0]?.[0]).toMatch(/^\$argon2id\$/);
    expect(sesiones.abrir).toHaveBeenCalledWith(
      { idUsuario: 7, correo: 'ana@x.gt', nombre: 'Ana', rol: 'Cliente' },
      CLIENTE,
    );
  });

  it('desactivar agrega al usuario a la lista de revocados después de que la base lo desactivó', async () => {
    const { servicio, repositorio, listaRevocados } = await preparar();

    await servicio.desactivar(7);

    expect(repositorio.cambiarEstado).toHaveBeenCalledWith(7, false);
    expect(listaRevocados.revocar).toHaveBeenCalledWith(7);
  });

  it('si la base rechaza la desactivación (por ejemplo, ULTIMO_ADMIN), no toca la lista de revocados', async () => {
    const { servicio, repositorio, listaRevocados } = await preparar();
    repositorio.cambiarEstado.mockRejectedValueOnce(new Error('ULTIMO_ADMIN'));

    await expect(servicio.desactivar(7)).rejects.toThrow();
    expect(listaRevocados.revocar).not.toHaveBeenCalled();
  });

  it('activar saca al usuario de la lista de revocados después de que la base lo activó', async () => {
    const { servicio, repositorio, listaRevocados } = await preparar();

    await servicio.activar(7);

    expect(listaRevocados.restaurar).toHaveBeenCalledWith(7);
    expect(listaRevocados.revocar).not.toHaveBeenCalled();
    expect(repositorio.cambiarEstado.mock.invocationCallOrder[0]).toBeLessThan(
      listaRevocados.restaurar.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('si la base rechaza la activación, no toca la lista de revocados', async () => {
    const { servicio, repositorio, listaRevocados } = await preparar();
    repositorio.cambiarEstado.mockRejectedValueOnce(new Error('NO_ENCONTRADO'));

    await expect(servicio.activar(7)).rejects.toThrow();

    expect(listaRevocados.restaurar).not.toHaveBeenCalled();
  });
});
