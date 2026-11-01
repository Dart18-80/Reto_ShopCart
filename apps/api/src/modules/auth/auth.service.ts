import { randomUUID } from 'node:crypto';
import { AppError } from '../../shared/errors/index.js';
import {
  VIGENCIA_ACCESO_SEG,
  type ClienteHttp,
  type TokensAcceso,
} from '../../shared/http/index.js';
import { hashearContrasena, verificarContrasena } from './auth.contrasenas.js';
import { DIAS_VIGENCIA_REFRESH, generarRefresh, hashearRefresh } from './auth.refresh.js';
import type { AuthRepository } from './auth.repository.js';
import type { DatosLogin, DatosRegistro } from './auth.schemas.js';
import type { IdentidadSesion, Sesion } from './auth.types.js';

interface Dependencias {
  repositorio: Pick<
    AuthRepository,
    | 'registrarCliente'
    | 'obtenerCredenciales'
    | 'registrarRefresh'
    | 'rotarRefresh'
    | 'revocarSesion'
  >;
  tokens: TokensAcceso;
}

export function crearAuthService({ repositorio, tokens }: Dependencias) {
  // A-07: la versión de sesión viaja en el access token; la respuesta solo lleva la identidad pública.
  async function armarSesion(
    { versionSesion, ...usuario }: IdentidadSesion,
    refreshToken: string,
  ): Promise<Sesion> {
    const accessToken = await tokens.emitir({
      idUsuario: usuario.idUsuario,
      rol: usuario.rol,
      versionSesion,
    });
    return { accessToken, expiraEn: VIGENCIA_ACCESO_SEG, refreshToken, usuario };
  }

  /** A-07: access token de 15 min y un refresh token nuevo de la familia (una familia por sesión). */
  async function abrirSesion(identidad: IdentidadSesion, cliente: ClienteHttp): Promise<Sesion> {
    const refresh = generarRefresh();
    await repositorio.registrarRefresh({
      idUsuario: identidad.idUsuario,
      idFamilia: randomUUID(),
      hash: refresh.hash,
      diasVigencia: DIAS_VIGENCIA_REFRESH,
      ip: cliente.ip,
      userAgent: cliente.userAgent,
    });
    return armarSesion(identidad, refresh.token);
  }

  return {
    abrirSesion,

    // N-15: el registro público solo crea Clientes (lo garantiza el SP) y deja la sesión abierta.
    async registrar(datos: DatosRegistro, cliente: ClienteHttp): Promise<Sesion> {
      const usuario = await repositorio.registrarCliente({
        correo: datos.correo,
        hashContrasena: await hashearContrasena(datos.contrasena),
        nombre: datos.nombre,
        telefono: datos.telefono ?? null,
      });
      return abrirSesion(usuario, cliente);
    },

    async iniciarSesion({ correo, contrasena }: DatosLogin, cliente: ClienteHttp): Promise<Sesion> {
      const credenciales = await repositorio.obtenerCredenciales(correo);
      // N-15: correo inexistente y contraseña incorrecta responden igual (y tardan lo mismo).
      const valida = await verificarContrasena(credenciales?.hashContrasena, contrasena);
      if (credenciales === null || !valida) throw new AppError('CREDENCIALES_INVALIDAS');
      // Solo se revela que está inactivo a quien ya demostró conocer la contraseña.
      if (!credenciales.activo) throw new AppError('USUARIO_INACTIVO');

      const { idUsuario, correo: correoGuardado, nombre, rol, versionSesion } = credenciales;
      return abrirSesion(
        { idUsuario, correo: correoGuardado, nombre, rol, versionSesion },
        cliente,
      );
    },

    // A-07: rotación por familia. El SP marca el token como usado y guarda el nuevo bajo bloqueo; un
    // reúso revoca la familia y llega como REFRESH_REUTILIZADO.
    async refrescar(token: string | undefined, cliente: ClienteHttp): Promise<Sesion> {
      if (token === undefined) throw new AppError('NO_AUTENTICADO');
      const nuevo = generarRefresh();
      const identidad = await repositorio.rotarRefresh({
        hashActual: hashearRefresh(token),
        hashNuevo: nuevo.hash,
        diasVigencia: DIAS_VIGENCIA_REFRESH,
        ip: cliente.ip,
        userAgent: cliente.userAgent,
      });
      if (identidad === null) throw new AppError('NO_AUTENTICADO');
      return armarSesion(identidad, nuevo.token);
    },

    async cerrarSesion(token: string | undefined): Promise<void> {
      if (token === undefined) return;
      await repositorio.revocarSesion(hashearRefresh(token), 'Logout');
    },
  };
}

export type AuthService = ReturnType<typeof crearAuthService>;
