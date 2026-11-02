import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import { AppError } from '../../shared/errors/index.js';
import {
  ejecutarConContexto,
  generarTokenOpaco,
  hashearTokenOpaco,
  obtenerContexto,
  VIGENCIA_ACCESO_SEG,
  type ClienteHttp,
  type TokensAcceso,
} from '../../shared/http/index.js';
import { hashearContrasena, verificarContrasena } from './auth.contrasenas.js';
import { DIAS_VIGENCIA_REFRESH } from './auth.refresh.js';
import type { InvalidadorReportes } from '../reportes/index.js';
import type { AuthRepository } from './auth.repository.js';
import type { DatosLogin, DatosRegistro } from './auth.schemas.js';
import { asignarCarritoDeInvitado, fusionarCarritoDeInvitado } from '../carrito/index.js';
import type {
  CarritoAlAbrirSesion,
  IdentidadSesion,
  Sesion,
  SesionAbierta,
  UsuarioSesion,
} from './auth.types.js';

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
  logger: Logger;
  /** A-11: el carrito de invitado que pasa al cliente cambia los carritos abandonados. */
  reportes: InvalidadorReportes;
}

// Fábricas y no constantes: nunca se comparte un objeto mutable entre peticiones.
const sinCambiosEnElCarrito = (): CarritoAlAbrirSesion => ({ cookieConsumida: false, avisos: [] });
const fusionPendiente = (): CarritoAlAbrirSesion => ({
  cookieConsumida: false,
  avisos: [
    {
      tipo: 'FusionPendiente',
      mensaje:
        'No pudimos pasar los productos de tu carrito de invitado. Lo intentaremos de nuevo la próxima vez que inicies sesión.',
    },
  ],
});

export function crearAuthService({ repositorio, tokens, logger, reportes }: Dependencias) {
  // A-18: los SPs del carrito toman al cliente del contexto. Solo esa llamada corre como él; el resto de la
  // petición sigue siendo anónima (el login no lleva token).
  function comoCliente<T>(usuario: UsuarioSesion, accion: () => Promise<T>): Promise<T> {
    const contexto = obtenerContexto();
    if (contexto === undefined) throw new Error('La sesión se abrió fuera de una petición');
    return ejecutarConContexto(
      { requestId: contexto.requestId, idUsuario: usuario.idUsuario, rol: usuario.rol },
      accion,
    );
  }

  /**
   * N-05: con la cookie de invitado, el carrito pasa al cliente (fusión al iniciar sesión, asignación al
   * registrarse). Solo el Cliente tiene carrito. Si falla, la sesión se abre igual, la cookie se conserva
   * para reintentar en el siguiente inicio de sesión, el error se registra y la respuesta lo avisa.
   */
  async function pasarCarritoDeInvitado(
    usuario: UsuarioSesion,
    tokenInvitado: string | undefined,
    pasar: (token: string) => Promise<CarritoAlAbrirSesion['avisos']>,
  ): Promise<CarritoAlAbrirSesion> {
    if (tokenInvitado === undefined || usuario.rol !== 'Cliente') return sinCambiosEnElCarrito();
    try {
      const avisos = await comoCliente(usuario, () => reportes.tras(pasar(tokenInvitado)));
      return { cookieConsumida: true, avisos };
    } catch (error) {
      logger.error(
        { err: error, idUsuario: usuario.idUsuario },
        'No se pudo pasar el carrito de invitado al cliente',
      );
      return fusionPendiente();
    }
  }

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
    const refresh = generarTokenOpaco();
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
    async registrar(
      datos: DatosRegistro,
      cliente: ClienteHttp,
      tokenInvitado?: string,
    ): Promise<SesionAbierta> {
      const usuario = await repositorio.registrarCliente({
        correo: datos.correo,
        hashContrasena: await hashearContrasena(datos.contrasena),
        nombre: datos.nombre,
        telefono: datos.telefono ?? null,
      });
      const sesion = await abrirSesion(usuario, cliente);
      // Al registrarse no hay nada que ajustar: el carrito de invitado pasa completo.
      const carrito = await pasarCarritoDeInvitado(sesion.usuario, tokenInvitado, async (token) => {
        await asignarCarritoDeInvitado(token);
        return [];
      });
      return { sesion, carrito };
    },

    async iniciarSesion(
      { correo, contrasena }: DatosLogin,
      cliente: ClienteHttp,
      tokenInvitado?: string,
    ): Promise<SesionAbierta> {
      const credenciales = await repositorio.obtenerCredenciales(correo);
      // N-15: correo inexistente y contraseña incorrecta responden igual (y tardan lo mismo).
      const valida = await verificarContrasena(credenciales?.hashContrasena, contrasena);
      if (credenciales === null || !valida) throw new AppError('CREDENCIALES_INVALIDAS');
      // Solo se revela que está inactivo a quien ya demostró conocer la contraseña.
      if (!credenciales.activo) throw new AppError('USUARIO_INACTIVO');

      const { idUsuario, correo: correoGuardado, nombre, rol, versionSesion } = credenciales;
      const sesion = await abrirSesion(
        { idUsuario, correo: correoGuardado, nombre, rol, versionSesion },
        cliente,
      );
      const carrito = await pasarCarritoDeInvitado(
        sesion.usuario,
        tokenInvitado,
        fusionarCarritoDeInvitado,
      );
      return { sesion, carrito };
    },

    // A-07: rotación por familia. El SP marca el token como usado y guarda el nuevo bajo bloqueo; un
    // reúso revoca la familia y llega como REFRESH_REUTILIZADO.
    async refrescar(token: string | undefined, cliente: ClienteHttp): Promise<Sesion> {
      if (token === undefined) throw new AppError('NO_AUTENTICADO');
      const nuevo = generarTokenOpaco();
      const identidad = await repositorio.rotarRefresh({
        hashActual: hashearTokenOpaco(token),
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
      await repositorio.revocarSesion(hashearTokenOpaco(token), 'Logout');
    },
  };
}

export type AuthService = ReturnType<typeof crearAuthService>;
