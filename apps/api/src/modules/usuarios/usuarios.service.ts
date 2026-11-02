import { AppError } from '../../shared/errors/index.js';
import {
  paginar,
  type ClienteHttp,
  type RespuestaPaginada,
  type VersionesSesion,
} from '../../shared/http/index.js';
import {
  hashearContrasena,
  verificarContrasena,
  type Sesion,
  type Sesiones,
} from '../auth/index.js';
import type { InvalidadorReportes } from '../reportes/index.js';
import type { UsuariosRepository } from './usuarios.repository.js';
import type {
  ActualizarPerfil,
  ActualizarUsuario,
  CambiarContrasena,
  CrearInterno,
} from './usuarios.schemas.js';
import type { FiltrosUsuarios, PerfilConHash, Usuario } from './usuarios.types.js';

interface Dependencias {
  repositorio: UsuariosRepository;
  sesiones: Sesiones;
  versiones: Pick<VersionesSesion, 'publicar'>;
  /** A-11: el nombre del cliente aparece en los carritos abandonados. */
  reportes: InvalidadorReportes;
}

export function crearUsuariosService({ repositorio, sesiones, versiones, reportes }: Dependencias) {
  async function perfilConHash(): Promise<PerfilConHash> {
    const perfil = await repositorio.obtenerPerfil();
    if (perfil === null) throw new AppError('NO_ENCONTRADO');
    return perfil;
  }

  return {
    async obtenerPerfil(): Promise<Usuario> {
      const { idUsuario, correo, nombre, telefono, rol, activo } = await perfilConHash();
      return { idUsuario, correo, nombre, telefono, rol, activo };
    },

    // PATCH: el SP mezcla los cambios con lo guardado bajo bloqueo; telefono en null lo quita.
    actualizarPerfil: (cambios: ActualizarPerfil): Promise<Usuario> =>
      reportes.tras(repositorio.actualizarPerfil(cambios)),

    /**
     * N-15, A-07: verifica la contraseña actual; el SP guarda la nueva, revoca todos los refresh tokens y
     * sube la versión de sesión. Publicarla corta los access tokens de las otras sesiones, y este
     * dispositivo recibe una sesión nueva con la versión nueva.
     */
    async cambiarContrasena(datos: CambiarContrasena, cliente: ClienteHttp): Promise<Sesion> {
      const perfil = await perfilConHash();
      if (!(await verificarContrasena(perfil.hashContrasena, datos.contrasenaActual))) {
        throw new AppError('PARAMETRO_INVALIDO', {
          mensaje: 'La contraseña actual no es correcta.',
        });
      }
      const versionSesion = await repositorio.cambiarContrasena(
        await hashearContrasena(datos.contrasenaNueva),
      );
      const { idUsuario, correo, nombre, rol } = perfil;
      await versiones.publicar(idUsuario, versionSesion);
      return sesiones.abrir({ idUsuario, correo, nombre, rol, versionSesion }, cliente);
    },

    async listar(filtros: FiltrosUsuarios): Promise<RespuestaPaginada<Usuario>> {
      const { usuarios, total } = await repositorio.listar(filtros);
      return paginar(usuarios, total, filtros);
    },

    async crearInterno(datos: CrearInterno): Promise<Usuario> {
      return repositorio.crearInterno({
        correo: datos.correo,
        hashContrasena: await hashearContrasena(datos.contrasena),
        nombre: datos.nombre,
        telefono: datos.telefono ?? null,
        rol: datos.rol,
      });
    },

    // A-07: con otro rol, el SP sube la versión de sesión y su access token deja de servir de inmediato.
    async actualizar(idUsuario: number, cambios: ActualizarUsuario): Promise<Usuario> {
      const { usuario, versionSesion } = await reportes.tras(
        repositorio.actualizar(idUsuario, cambios.nombre ?? null, cambios.rol ?? null),
      );
      if (cambios.rol !== undefined) await versiones.publicar(idUsuario, versionSesion);
      return usuario;
    },

    // N-15, A-07: el SP revoca los refresh tokens y sube la versión de sesión; publicarla corta su access
    // token de inmediato y no a los 15 minutos.
    async desactivar(idUsuario: number): Promise<Usuario> {
      const { usuario, versionSesion } = await repositorio.cambiarEstado(idUsuario, false);
      await versiones.publicar(idUsuario, versionSesion);
      return usuario;
    },

    // A-07: reactivar no toca la versión, así que los access tokens previos a la desactivación siguen
    // rechazados; el usuario inicia sesión de nuevo.
    async activar(idUsuario: number): Promise<Usuario> {
      return (await repositorio.cambiarEstado(idUsuario, true)).usuario;
    },
  };
}

export type UsuariosService = ReturnType<typeof crearUsuariosService>;
