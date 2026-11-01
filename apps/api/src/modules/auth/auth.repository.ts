import sql from 'mssql';
import { ejecutarSP } from '../../shared/db/index.js';
import { esRolDeUsuario, type Rol } from '../../shared/http/index.js';
import type { Credenciales, IdentidadSesion } from './auth.types.js';

interface FilaUsuario {
  IDUsuario: number;
  Correo: string;
  Nombre: string;
  Rol: string;
  VersionSesion: number;
}

interface FilaCredenciales extends FilaUsuario {
  HashContrasena: string;
  Activo: boolean;
}

export interface DatosNuevoCliente {
  correo: string;
  hashContrasena: string;
  nombre: string;
  telefono: string | null;
}

export interface DatosRefresh {
  idUsuario: number;
  idFamilia: string;
  hash: Buffer;
  diasVigencia: number;
  ip: string | null;
  userAgent: string | null;
}

function aRol(rol: string): Rol {
  if (!esRolDeUsuario(rol)) throw new Error(`Rol inesperado desde la base: ${rol}`);
  return rol;
}

const aIdentidad = (fila: FilaUsuario): IdentidadSesion => ({
  idUsuario: fila.IDUsuario,
  correo: fila.Correo,
  nombre: fila.Nombre,
  rol: aRol(fila.Rol),
  versionSesion: fila.VersionSesion,
});

export interface DatosRotacion {
  hashActual: Buffer;
  hashNuevo: Buffer;
  diasVigencia: number;
  ip: string | null;
  userAgent: string | null;
}

export type MotivoRevocacion = 'Logout' | 'Reuso' | 'Desactivacion' | 'CambioContrasena';

export const authRepository = {
  async registrarCliente(datos: DatosNuevoCliente): Promise<IdentidadSesion> {
    const [fila] = await ejecutarSP<FilaUsuario>('SP_Auth_RegistrarCliente', {
      Correo: { tipo: sql.NVarChar(254), valor: datos.correo },
      HashContrasena: { tipo: sql.VarChar(255), valor: datos.hashContrasena },
      Nombre: { tipo: sql.NVarChar(100), valor: datos.nombre },
      Telefono: { tipo: sql.VarChar(8), valor: datos.telefono },
    });
    if (fila === undefined) throw new Error('SP_Auth_RegistrarCliente no devolvió el usuario');
    return aIdentidad(fila);
  },

  async obtenerCredenciales(correo: string): Promise<Credenciales | null> {
    const [fila] = await ejecutarSP<FilaCredenciales>('SP_Auth_ObtenerCredenciales', {
      Correo: { tipo: sql.NVarChar(254), valor: correo },
    });
    if (fila === undefined) return null;
    return { ...aIdentidad(fila), hashContrasena: fila.HashContrasena, activo: fila.Activo };
  },

  async registrarRefresh(datos: DatosRefresh): Promise<void> {
    await ejecutarSP('SP_Auth_RegistrarRefreshToken', {
      IDUsuario: { tipo: sql.Int, valor: datos.idUsuario },
      IDFamilia: { tipo: sql.UniqueIdentifier, valor: datos.idFamilia },
      // BINARY(32): en mssql el tipo Binary no recibe largo; el SP declara el largo exacto.
      HashToken: { tipo: sql.Binary, valor: datos.hash },
      DiasVigencia: { tipo: sql.Int, valor: datos.diasVigencia },
      IP: { tipo: sql.VarChar(45), valor: datos.ip },
      UserAgent: { tipo: sql.NVarChar(300), valor: datos.userAgent },
    });
  },

  /** null si la base no rotó el token (desconocido, vencido, revocado o usuario inactivo). */
  async rotarRefresh(datos: DatosRotacion): Promise<IdentidadSesion | null> {
    // El reúso llega como AppError REFRESH_REUTILIZADO (THROW 50102) desde el SP.
    const [fila] = await ejecutarSP<FilaUsuario>('SP_Auth_RotarRefreshToken', {
      HashToken: { tipo: sql.Binary, valor: datos.hashActual },
      NuevoHash: { tipo: sql.Binary, valor: datos.hashNuevo },
      DiasVigencia: { tipo: sql.Int, valor: datos.diasVigencia },
      IP: { tipo: sql.VarChar(45), valor: datos.ip },
      UserAgent: { tipo: sql.NVarChar(300), valor: datos.userAgent },
    });
    return fila === undefined ? null : aIdentidad(fila);
  },

  async revocarSesion(hash: Buffer, motivo: MotivoRevocacion): Promise<void> {
    await ejecutarSP('SP_Auth_RevocarSesion', {
      HashToken: { tipo: sql.Binary, valor: hash },
      Motivo: { tipo: sql.VarChar(30), valor: motivo },
    });
  },
};

export type AuthRepository = typeof authRepository;
