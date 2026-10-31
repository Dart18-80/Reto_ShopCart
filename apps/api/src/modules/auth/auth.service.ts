import { randomUUID } from 'node:crypto';
import { AppError } from '../../shared/errors/index.js';
import {
  VIGENCIA_ACCESO_SEG,
  type ClienteHttp,
  type TokensAcceso,
} from '../../shared/http/index.js';
import { hashearContrasena, verificarContrasena } from './auth.contrasenas.js';
import { DIAS_VIGENCIA_REFRESH, generarRefresh } from './auth.refresh.js';
import type { AuthRepository } from './auth.repository.js';
import type { DatosLogin, DatosRegistro } from './auth.schemas.js';
import type { Sesion, UsuarioSesion } from './auth.types.js';

interface Dependencias {
  repositorio: Pick<
    AuthRepository,
    'registrarCliente' | 'obtenerCredenciales' | 'registrarRefresh'
  >;
  tokens: TokensAcceso;
}

export function crearAuthService({ repositorio, tokens }: Dependencias) {
  /** A-07: access token de 15 min y un refresh token nuevo de la familia (una familia por sesión). */
  async function abrirSesion(
    usuario: UsuarioSesion,
    cliente: ClienteHttp,
    idFamilia: string = randomUUID(),
  ): Promise<Sesion> {
    const refresh = generarRefresh();
    await repositorio.registrarRefresh({
      idUsuario: usuario.idUsuario,
      idFamilia,
      hash: refresh.hash,
      diasVigencia: DIAS_VIGENCIA_REFRESH,
      ip: cliente.ip,
      userAgent: cliente.userAgent,
    });
    const accessToken = await tokens.emitir({ idUsuario: usuario.idUsuario, rol: usuario.rol });
    return { accessToken, expiraEn: VIGENCIA_ACCESO_SEG, refreshToken: refresh.token, usuario };
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

      const { idUsuario, correo: correoGuardado, nombre, rol } = credenciales;
      return abrirSesion({ idUsuario, correo: correoGuardado, nombre, rol }, cliente);
    },
  };
}

export type AuthService = ReturnType<typeof crearAuthService>;
