import { ErrorApi } from '../ErrorApi';
import type { Respuesta } from '../tipos';

type SesionDelBackend = Respuesta<'/api/v1/auth/refresh', 'post'>['datos'];

/** Lo que la sesión guarda de la respuesta de login, registro o refresh: el token y quién es (A-07). */
export type DatosSesion = Pick<SesionDelBackend, 'accessToken' | 'usuario'>;
export type Usuario = DatosSesion['usuario'];
export type Rol = Usuario['rol'];

export type EstadoSesion =
  | { readonly tipo: 'invitado' }
  | { readonly tipo: 'rehidratando' }
  | { readonly tipo: 'activa'; readonly usuario: Usuario }
  /** La rehidratación falló por red o por un 5xx: no se sabe si hay sesión (05 §5). */
  | { readonly tipo: 'noVerificada'; readonly error: ErrorApi };

export type MensajeSesion = { tipo: 'token'; sesion: DatosSesion } | { tipo: 'cerrada' };

/** Exclusión mutua entre pestañas para renovar (Web Locks, con un respaldo por pestaña). */
export interface Bloqueo {
  exclusivo<T>(tarea: () => Promise<T>): Promise<T>;
}

/** Aviso entre pestañas del mismo navegador (BroadcastChannel). */
export interface Canal {
  publicar(mensaje: MensajeSesion): void;
  alRecibir(receptor: (mensaje: MensajeSesion) => void): void;
}

interface DependenciasSesion {
  /** `POST /auth/refresh`; lanza ErrorApi. */
  refrescar: () => Promise<DatosSesion>;
  /** `POST /auth/logout`; lanza ErrorApi. */
  cerrarEnServidor: () => Promise<void>;
  bloqueo: Bloqueo;
  canal: Canal;
}

const INVITADO: EstadoSesion = { tipo: 'invitado' };
const REHIDRATANDO: EstadoSesion = { tipo: 'rehidratando' };
const STATUS_NO_AUTENTICADO = 401;

const idUsuarioDe = (estado: EstadoSesion) =>
  estado.tipo === 'activa' ? estado.usuario.idUsuario : null;

const soloSesion = ({ accessToken, usuario }: DatosSesion): DatosSesion => ({
  accessToken,
  usuario,
});

/**
 * FE-05: el access token vive solo en esta variable del módulo. Una renovación a la vez por pestaña (single-flight)
 * y, entre pestañas, dentro del bloqueo; la que lo hace publica el resultado por el canal.
 */
export function crearSesion({ refrescar, cerrarEnServidor, bloqueo, canal }: DependenciasSesion) {
  let token: string | null = null;
  let estado: EstadoSesion = INVITADO;
  let renovacionEnCurso: Promise<string | null> | null = null;
  let rehidratacion: Promise<void> = Promise.resolve();
  const suscriptores = new Set<() => void>();
  const reaccionesAlCambiarUsuario = new Set<() => void>();

  function fijarEstado(nuevo: EstadoSesion) {
    const anterior = estado;
    estado = nuevo;
    suscriptores.forEach((avisar) => {
      avisar();
    });
    // Al terminar la rehidratación no se avisa: las peticiones la esperan, así que la caché no tiene datos de otro.
    if (anterior.tipo !== 'rehidratando' && idUsuarioDe(anterior) !== idUsuarioDe(nuevo)) {
      reaccionesAlCambiarUsuario.forEach((reaccionar) => {
        reaccionar();
      });
    }
  }

  function adoptar(datos: DatosSesion) {
    token = datos.accessToken;
    fijarEstado({ tipo: 'activa', usuario: datos.usuario });
  }

  function cerrarLocal() {
    token = null;
    fijarEstado(INVITADO);
  }

  canal.alRecibir((mensaje) => {
    if (mensaje.tipo === 'token') adoptar(mensaje.sesion);
    else cerrarLocal();
  });

  async function renovarConBloqueo(tokenAlPedir: string | null): Promise<string | null> {
    // Mientras esperaba el bloqueo, otra pestaña pudo renovar o cerrar la sesión y avisarlo por el canal:
    // pedir otro refresh con la cookie que esa pestaña ya rotó sería un reúso (A-07).
    if (token !== tokenAlPedir) return token;
    try {
      const datos = soloSesion(await refrescar());
      adoptar(datos);
      canal.publicar({ tipo: 'token', sesion: datos });
      return datos.accessToken;
    } catch (error) {
      if (!(error instanceof ErrorApi) || error.status !== STATUS_NO_AUTENTICADO) throw error;
      // REFRESH_REUTILIZADO, USUARIO_INACTIVO o sin cookie: ninguna pestaña puede renovar.
      cerrarLocal();
      canal.publicar({ tipo: 'cerrada' });
      return null;
    }
  }

  function renovarUnaVez(tokenAlPedir: string | null): Promise<string | null> {
    renovacionEnCurso ??= bloqueo
      .exclusivo(() => renovarConBloqueo(tokenAlPedir))
      .finally(() => {
        renovacionEnCurso = null;
      });
    return renovacionEnCurso;
  }

  return {
    estado: () => estado,
    token: () => token,

    /** Para `useSyncExternalStore`, que la recibe suelta: avisa de cada cambio de estado; devuelve cómo cancelar. */
    suscribir: (avisar: () => void) => {
      suscriptores.add(avisar);
      return () => {
        suscriptores.delete(avisar);
      };
    },

    /** Avisa cuando cambia quién está conectado, también al cerrar: ahí se vacía la caché (FE-05). */
    alCambiarUsuario(reaccionar: () => void) {
      reaccionesAlCambiarUsuario.add(reaccionar);
      return () => {
        reaccionesAlCambiarUsuario.delete(reaccionar);
      };
    },

    /**
     * El refresh al cargar la aplicación (y el Reintentar de una sesión no verificada). Nunca rechaza: una falla
     * de red o un 5xx deja la sesión no verificada.
     */
    rehidratar(): Promise<void> {
      if (estado.tipo === 'rehidratando' || estado.tipo === 'activa') return rehidratacion;
      fijarEstado(REHIDRATANDO);
      rehidratacion = renovarUnaVez(null).then(
        () => undefined,
        (error: unknown) => {
          if (!(error instanceof ErrorApi)) throw error;
          fijarEstado({ tipo: 'noVerificada', error });
        },
      );
      return rehidratacion;
    },

    esperarRehidratacion: () => rehidratacion,

    /**
     * Ante un 401 de una petición que salió con `tokenRechazado` (null si salió sin sesión): devuelve el token con
     * que reintentarla, o null para no reintentar. Solo pide el refresh si hay sesión y ese token es el vigente; si
     * otra petición o pestaña ya lo cambió, devuelve el vigente.
     */
    renovar(tokenRechazado: string | null): Promise<string | null> {
      // Un invitado con 401 no renueva: no hay sesión que renovar (05 §5).
      if (token === null || token !== tokenRechazado) return Promise.resolve(token);
      return renovarUnaVez(token);
    },

    /** Lo usan el login y el registro: la sesión pasa también a las demás pestañas. */
    establecer(datos: DatosSesion) {
      const sesion = soloSesion(datos);
      adoptar(sesion);
      canal.publicar({ tipo: 'token', sesion });
    },

    /** Cierra la sesión en el servidor y en todas las pestañas; la local se cierra aunque el logout falle. */
    async cerrar() {
      try {
        await cerrarEnServidor();
      } finally {
        cerrarLocal();
        canal.publicar({ tipo: 'cerrada' });
      }
    },

    /** Olvida la sesión solo en esta pestaña, sin avisar al servidor ni a las demás: las pruebas empiezan así. */
    olvidar: cerrarLocal,
  };
}

export type Sesion = ReturnType<typeof crearSesion>;
