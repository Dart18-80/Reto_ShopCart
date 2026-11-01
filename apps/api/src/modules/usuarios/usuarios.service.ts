import { AppError } from '../../shared/errors/index.js';
import {
  paginar,
  type ClienteHttp,
  type ListaRevocados,
  type RespuestaPaginada,
} from '../../shared/http/index.js';
import {
  hashearContrasena,
  verificarContrasena,
  type Sesion,
  type Sesiones,
} from '../auth/index.js';
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
  listaRevocados: ListaRevocados;
}

export function crearUsuariosService({ repositorio, sesiones, listaRevocados }: Dependencias) {
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

    // PATCH: lo que no llega se conserva; telefono en null lo quita.
    async actualizarPerfil(cambios: ActualizarPerfil): Promise<Usuario> {
      const actual = await perfilConHash();
      return repositorio.actualizarPerfil(
        cambios.nombre ?? actual.nombre,
        cambios.telefono === undefined ? actual.telefono : cambios.telefono,
      );
    },

    /**
     * N-15: verifica la contraseña actual, guarda la nueva y revoca todas las sesiones (lo hace el SP).
     * La cookie de refresh no llega a esta ruta, así que no se distingue la sesión actual: se abre una
     * nueva para este dispositivo.
     */
    async cambiarContrasena(datos: CambiarContrasena, cliente: ClienteHttp): Promise<Sesion> {
      const perfil = await perfilConHash();
      if (!(await verificarContrasena(perfil.hashContrasena, datos.contrasenaActual))) {
        throw new AppError('PARAMETRO_INVALIDO', {
          mensaje: 'La contraseña actual no es correcta.',
        });
      }
      await repositorio.cambiarContrasena(await hashearContrasena(datos.contrasenaNueva));
      const { idUsuario, correo, nombre, rol } = perfil;
      return sesiones.abrir({ idUsuario, correo, nombre, rol }, cliente);
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

    actualizar: (idUsuario: number, cambios: ActualizarUsuario): Promise<Usuario> =>
      repositorio.actualizar(idUsuario, cambios.nombre ?? null, cambios.rol ?? null),

    // N-15: el SP revoca los refresh tokens; aquí se agrega a la lista de revocados para que su access
    // token deje de servir de inmediato y no a los 15 minutos.
    async desactivar(idUsuario: number): Promise<Usuario> {
      const usuario = await repositorio.cambiarEstado(idUsuario, false);
      await listaRevocados.revocar(idUsuario);
      return usuario;
    },

    // N-15: sin esto, un usuario reactivado seguiría con 401 hasta que venciera su clave en Redis.
    async activar(idUsuario: number): Promise<Usuario> {
      const usuario = await repositorio.cambiarEstado(idUsuario, true);
      await listaRevocados.restaurar(idUsuario);
      return usuario;
    },
  };
}

export type UsuariosService = ReturnType<typeof crearUsuariosService>;
