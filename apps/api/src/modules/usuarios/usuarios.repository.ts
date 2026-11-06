import sql from 'mssql';
import { ejecutarSP, ejecutarSPPaginado } from '../../shared/db/index.js';
import { aRolDeUsuario, type RolDeUsuario } from '../../shared/http/index.js';
import type { ActualizarPerfil } from './usuarios.schemas.js';
import type {
  FiltrosUsuarios,
  PerfilConHash,
  Usuario,
  UsuarioConVersion,
} from './usuarios.types.js';

interface FilaUsuario {
  IDUsuario: number;
  Correo: string;
  Nombre: string;
  Telefono: string | null;
  Rol: string;
  Activo: boolean;
}

interface FilaPerfil extends FilaUsuario {
  HashContrasena: string;
}

interface FilaConVersion extends FilaUsuario {
  VersionSesion: number;
}

export interface DatosNuevoInterno {
  correo: string;
  hashContrasena: string;
  nombre: string;
  telefono: string | null;
  rol: RolDeUsuario;
}

const aUsuario = (fila: FilaUsuario): Usuario => ({
  idUsuario: fila.IDUsuario,
  correo: fila.Correo,
  nombre: fila.Nombre,
  telefono: fila.Telefono,
  rol: aRolDeUsuario(fila.Rol),
  activo: fila.Activo,
});

function unico(filas: FilaUsuario[], sp: string): Usuario {
  const [fila] = filas;
  if (fila === undefined) throw new Error(`${sp} no devolvió el usuario`);
  return aUsuario(fila);
}

function unicoConVersion(filas: FilaConVersion[], sp: string): UsuarioConVersion {
  const [fila] = filas;
  if (fila === undefined) throw new Error(`${sp} no devolvió el usuario`);
  return { usuario: aUsuario(fila), versionSesion: fila.VersionSesion };
}

export const usuariosRepository = {
  // RF-01: el perfil sale de @IDUsuarioActor (el token); el repositorio no recibe el ID del cliente.
  async obtenerPerfil(): Promise<PerfilConHash | null> {
    const [fila] = await ejecutarSP<FilaPerfil>('SP_Usuarios_ObtenerPerfil');
    return fila === undefined ? null : { ...aUsuario(fila), hashContrasena: fila.HashContrasena };
  },

  // PATCH: un campo ausente va en NULL (sin cambio) y telefono en null lo quita; el SP mezcla bajo bloqueo.
  async actualizarPerfil(cambios: ActualizarPerfil): Promise<Usuario> {
    const filas = await ejecutarSP<FilaUsuario>('SP_Usuarios_ActualizarPerfil', {
      Nombre: { tipo: sql.NVarChar(100), valor: cambios.nombre ?? null },
      Telefono: { tipo: sql.VarChar(8), valor: cambios.telefono ?? null },
      QuitarTelefono: { tipo: sql.Bit, valor: cambios.telefono === null },
    });
    return unico(filas, 'SP_Usuarios_ActualizarPerfil');
  },

  /** Devuelve la versión de sesión nueva (A-07). */
  async cambiarContrasena(hashContrasena: string): Promise<number> {
    const [fila] = await ejecutarSP<{ VersionSesion: number }>('SP_Usuarios_CambiarContrasena', {
      HashContrasena: { tipo: sql.VarChar(255), valor: hashContrasena },
    });
    if (fila === undefined) throw new Error('SP_Usuarios_CambiarContrasena no devolvió la versión');
    return fila.VersionSesion;
  },

  async listar(filtros: FiltrosUsuarios): Promise<{ usuarios: Usuario[]; total: number }> {
    const { filas, total } = await ejecutarSPPaginado<FilaUsuario>('SP_Usuarios_Listar', {
      Pagina: { tipo: sql.Int, valor: filtros.pagina },
      Tamano: { tipo: sql.Int, valor: filtros.tamano },
      Rol: { tipo: sql.VarChar(20), valor: filtros.rol },
      Activo: { tipo: sql.Bit, valor: filtros.activo },
      Orden: { tipo: sql.VarChar(20), valor: filtros.orden },
      Direccion: { tipo: sql.VarChar(4), valor: filtros.direccion },
    });
    return { usuarios: filas.map(aUsuario), total };
  },

  async crearInterno(datos: DatosNuevoInterno): Promise<Usuario> {
    const filas = await ejecutarSP<FilaUsuario>('SP_Usuarios_CrearInterno', {
      Correo: { tipo: sql.NVarChar(254), valor: datos.correo },
      HashContrasena: { tipo: sql.VarChar(255), valor: datos.hashContrasena },
      Nombre: { tipo: sql.NVarChar(100), valor: datos.nombre },
      Telefono: { tipo: sql.VarChar(8), valor: datos.telefono },
      Rol: { tipo: sql.VarChar(20), valor: datos.rol },
    });
    return unico(filas, 'SP_Usuarios_CrearInterno');
  },

  /** nombre o rol en null: sin cambio. */
  async actualizar(
    idUsuario: number,
    nombre: string | null,
    rol: RolDeUsuario | null,
  ): Promise<UsuarioConVersion> {
    const filas = await ejecutarSP<FilaConVersion>('SP_Usuarios_Actualizar', {
      IDUsuario: { tipo: sql.Int, valor: idUsuario },
      Nombre: { tipo: sql.NVarChar(100), valor: nombre },
      Rol: { tipo: sql.VarChar(20), valor: rol },
    });
    return unicoConVersion(filas, 'SP_Usuarios_Actualizar');
  },

  async cambiarEstado(idUsuario: number, activo: boolean): Promise<UsuarioConVersion> {
    const filas = await ejecutarSP<FilaConVersion>('SP_Usuarios_CambiarEstado', {
      IDUsuario: { tipo: sql.Int, valor: idUsuario },
      Activo: { tipo: sql.Bit, valor: activo },
    });
    return unicoConVersion(filas, 'SP_Usuarios_CambiarEstado');
  },
};

export type UsuariosRepository = typeof usuariosRepository;
