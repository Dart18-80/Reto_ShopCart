import { describe, expect, it, vi } from 'vitest';
import { hashearContrasena, type Sesiones } from '../../../../src/modules/auth/index.js';
import type { UsuariosRepository } from '../../../../src/modules/usuarios/usuarios.repository.js';
import { crearUsuariosService } from '../../../../src/modules/usuarios/usuarios.service.js';
import type { PerfilConHash, Usuario } from '../../../../src/modules/usuarios/usuarios.types.js';
import type { VersionesSesion } from '../../../../src/shared/http/index.js';

const CONTRASENA = 'Actual2026';
const CLIENTE = { ip: '203.0.113.7', userAgent: 'pruebas' };
const VERSION_NUEVA = 4;

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
    cambiarContrasena: vi.fn((_hash: string) => Promise.resolve(VERSION_NUEVA)),
    listar: vi.fn(() => Promise.resolve({ usuarios: [USUARIO], total: 1 })),
    crearInterno: vi.fn(() => Promise.resolve(USUARIO)),
    actualizar: vi.fn(() => Promise.resolve({ usuario: USUARIO, versionSesion: VERSION_NUEVA })),
    cambiarEstado: vi.fn((_id: number, activo: boolean) =>
      Promise.resolve({ usuario: { ...USUARIO, activo }, versionSesion: VERSION_NUEVA }),
    ),
  } satisfies UsuariosRepository;
  const sesiones = {
    abrir: vi.fn<Sesiones['abrir']>((usuario) =>
      Promise.resolve({ accessToken: 'a', expiraEn: 900, refreshToken: 'r', usuario }),
    ),
  };
  const versiones = { publicar: vi.fn<VersionesSesion['publicar']>(() => Promise.resolve()) };
  const servicio = crearUsuariosService({ repositorio, sesiones, versiones });
  return { servicio, repositorio, sesiones, versiones };
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

  it('A-07: con la contraseña correcta publica la versión nueva y abre esta sesión con ella', async () => {
    const { servicio, repositorio, sesiones, versiones } = await preparar();

    await servicio.cambiarContrasena(
      { contrasenaActual: CONTRASENA, contrasenaNueva: 'Nueva2027' },
      CLIENTE,
    );

    expect(repositorio.cambiarContrasena.mock.calls[0]?.[0]).toMatch(/^\$argon2id\$/);
    expect(versiones.publicar).toHaveBeenCalledWith(7, VERSION_NUEVA);
    expect(sesiones.abrir).toHaveBeenCalledWith(
      {
        idUsuario: 7,
        correo: 'ana@x.gt',
        nombre: 'Ana',
        rol: 'Cliente',
        versionSesion: VERSION_NUEVA,
      },
      CLIENTE,
    );
  });

  it('A-07: desactivar publica la versión que subió la base', async () => {
    const { servicio, repositorio, versiones } = await preparar();

    await servicio.desactivar(7);

    expect(repositorio.cambiarEstado).toHaveBeenCalledWith(7, false);
    expect(versiones.publicar).toHaveBeenCalledWith(7, VERSION_NUEVA);
  });

  it('si la base rechaza la desactivación (por ejemplo, ULTIMO_ADMIN), no publica nada', async () => {
    const { servicio, repositorio, versiones } = await preparar();
    repositorio.cambiarEstado.mockRejectedValueOnce(new Error('ULTIMO_ADMIN'));

    await expect(servicio.desactivar(7)).rejects.toThrow();
    expect(versiones.publicar).not.toHaveBeenCalled();
  });

  it('A-07: activar no publica nada: la versión no baja y los tokens viejos siguen rechazados', async () => {
    const { servicio, versiones } = await preparar();

    await servicio.activar(7);

    expect(versiones.publicar).not.toHaveBeenCalled();
  });

  it('A-07: cambiar el rol publica la versión; cambiar solo el nombre no', async () => {
    const { servicio, versiones } = await preparar();

    await servicio.actualizar(7, { nombre: 'Ana María' });
    await servicio.actualizar(7, { rol: 'Operador' });

    expect(versiones.publicar).toHaveBeenCalledOnce();
    expect(versiones.publicar).toHaveBeenCalledWith(7, VERSION_NUEVA);
  });
});
