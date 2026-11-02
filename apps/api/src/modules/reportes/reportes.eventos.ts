import type { Logger } from 'pino';
import type { AvisoDeVersion, AvisosDeVersion } from '../../shared/avisos/index.js';
import type { Cache } from '../../shared/cache/index.js';
import { AppError } from '../../shared/errors/index.js';
import { ATRIBUTOS, enSpan } from '../../shared/observability/index.js';
import { relojDelSistema, type Reloj } from '../../shared/reloj/index.js';
import { claveDeVersion, DOMINIOS_REPORTES, type DominioReportes } from './reportes.cache.js';

/** E9-H02: como máximo un evento por dominio en esta ventana, por réplica: una ráfaga de compras no inunda. */
export const VENTANA_AGRUPACION_MS = 2_000;
/** Comentario SSE para que los proxies no corten una conexión callada; también revisa el token y la sesión. */
export const INTERVALO_LATIDO_MS = 15_000;
/** Conexiones abiertas del mismo usuario en una réplica (varias pestañas del dashboard). */
export const MAX_CONEXIONES_POR_USUARIO = 3;

/** Un stream abierto: el difusor no conoce HTTP, solo escribe texto y lo cierra. */
export interface ClienteDeEventos {
  idUsuario: number;
  /** El vencimiento de su access token: a esa hora se cierra el stream (A-07). */
  venceEn: Date;
  /** false si la versión de sesión del usuario cambió (desactivado, otro rol u otra contraseña). */
  sesionVigente(): Promise<boolean>;
  escribir(texto: string): void;
  cerrar(): void;
}

export interface DifusorDeVersiones {
  /**
   * Envía las versiones actuales y deja el stream conectado. Lanza 429 CONEXIONES_MAXIMAS si el usuario ya tiene
   * el máximo en esta réplica. Devuelve cómo desconectarlo (al cerrarse la petición).
   */
  conectar(cliente: ClienteDeEventos, ultimoEventoId?: string): Promise<() => void>;
  /** Apagado ordenado (SIGTERM): cierra todos los streams para que el cliente reconecte a la otra réplica. */
  cerrarTodas(): void;
}

interface Dependencias {
  cache: Pick<Cache, 'contador'>;
  avisos: AvisosDeVersion;
  logger: Logger;
  reloj?: Reloj;
  /** Cada cuánto se envía el latido y se revisan las conexiones (las pruebas de integración lo acortan). */
  latidoMs?: number;
}

type Versiones = Record<DominioReportes, number>;

interface Agrupacion {
  ultimaDifusion: number;
  temporizador: NodeJS.Timeout | undefined;
}

const esDominio = (dominio: string): dominio is DominioReportes =>
  (DOMINIOS_REPORTES as readonly string[]).includes(dominio);

// El mismo formato que la llave de la caché (A-11): `ventas3.carritos7`.
const idDe = (versiones: Versiones): string =>
  DOMINIOS_REPORTES.map((dominio) => `${dominio}${String(versiones[dominio])}`).join('.');

const evento = (nombre: string, id: string, datos: unknown): string =>
  `id: ${id}\nevent: ${nombre}\ndata: ${JSON.stringify(datos)}\n\n`;

const LATIDO = ': latido\n\n';

/**
 * E9-H02 (A-25): reenvía a los streams de esta réplica cada aviso de versión que llega por el canal entre réplicas.
 * Solo avisos («cambió ventas»): el cliente vuelve a pedir el reporte, que sale de la caché.
 */
export function crearDifusorDeVersiones({
  cache,
  avisos,
  logger,
  reloj = relojDelSistema,
  latidoMs = INTERVALO_LATIDO_MS,
}: Dependencias): DifusorDeVersiones {
  const clientes = new Set<ClienteDeEventos>();
  const conocidas: Versiones = { ventas: 0, carritos: 0 };
  const agrupaciones = new Map<DominioReportes, Agrupacion>();
  // Conexiones que pasaron el límite y todavía leen las versiones: cuentan para el límite.
  const reservadas = new Map<number, number>();
  let latido: NodeJS.Timeout | undefined;

  async function leerVersiones(): Promise<Versiones> {
    for (const dominio of DOMINIOS_REPORTES) {
      const version = await cache.contador(claveDeVersion(dominio));
      // Con Redis caído se queda la última conocida.
      if (version !== null) conocidas[dominio] = Math.max(conocidas[dominio], version);
    }
    return { ...conocidas };
  }

  function quitar(cliente: ClienteDeEventos): void {
    if (!clientes.delete(cliente)) return;
    cliente.cerrar();
    if (clientes.size === 0) {
      clearInterval(latido);
      latido = undefined;
    }
  }

  function escribirATodos(texto: string): void {
    for (const cliente of clientes) cliente.escribir(texto);
  }

  function difundir(dominio: DominioReportes): Promise<void> {
    const atributos = {
      [ATRIBUTOS.dominioSse]: dominio,
      [ATRIBUTOS.versionSse]: conocidas[dominio],
      [ATRIBUTOS.clientesSse]: clientes.size,
    };
    return enSpan('sse.difundir', atributos, () => {
      escribirATodos(evento('cambio', idDe(conocidas), { dominio, version: conocidas[dominio] }));
      return Promise.resolve();
    });
  }

  // El primero de la ventana sale de inmediato; los demás esperan al cierre y sale solo la última versión.
  function agrupar(dominio: DominioReportes): void {
    const ahora = reloj.ahora().getTime();
    const agrupacion = agrupaciones.get(dominio) ?? { ultimaDifusion: 0, temporizador: undefined };
    agrupaciones.set(dominio, agrupacion);
    if (agrupacion.temporizador !== undefined) return;
    const espera = agrupacion.ultimaDifusion + VENTANA_AGRUPACION_MS - ahora;
    if (espera <= 0) {
      agrupacion.ultimaDifusion = ahora;
      void difundir(dominio);
      return;
    }
    agrupacion.temporizador = setTimeout(() => {
      agrupacion.temporizador = undefined;
      agrupacion.ultimaDifusion = reloj.ahora().getTime();
      void difundir(dominio);
    }, espera);
    agrupacion.temporizador.unref();
  }

  function alRecibir({ dominio, version }: AvisoDeVersion): void {
    if (!esDominio(dominio) || version <= conocidas[dominio]) return;
    conocidas[dominio] = version;
    agrupar(dominio);
  }

  // Lo publicado durante la caída se perdió: se envían las versiones actuales y el cliente decide si recarga.
  async function alReconectar(): Promise<void> {
    const versiones = await leerVersiones();
    escribirATodos(evento('versiones', idDe(versiones), { versiones, recargar: true }));
  }

  async function revisar(cliente: ClienteDeEventos): Promise<void> {
    if (reloj.ahora() >= cliente.venceEn || !(await cliente.sesionVigente())) {
      quitar(cliente);
      return;
    }
    cliente.escribir(LATIDO);
  }

  function iniciarLatido(): void {
    if (latido !== undefined) return;
    latido = setInterval(() => {
      for (const cliente of clientes) {
        revisar(cliente).catch((error: unknown) => {
          logger.error({ err: error }, 'No se pudo revisar un stream del dashboard');
        });
      }
    }, latidoMs);
    latido.unref();
  }

  avisos.suscribir({
    alRecibir,
    alReconectar: () => {
      alReconectar().catch((error: unknown) => {
        logger.error({ err: error }, 'No se pudieron reenviar las versiones del dashboard');
      });
    },
  });

  return {
    async conectar(cliente, ultimoEventoId) {
      const { idUsuario } = cliente;
      const abiertas = [...clientes].filter((c) => c.idUsuario === idUsuario).length;
      if (abiertas + (reservadas.get(idUsuario) ?? 0) >= MAX_CONEXIONES_POR_USUARIO) {
        throw new AppError('CONEXIONES_MAXIMAS');
      }
      reservadas.set(idUsuario, (reservadas.get(idUsuario) ?? 0) + 1);
      let versiones: Versiones;
      try {
        versiones = await leerVersiones();
      } finally {
        const restantes = (reservadas.get(idUsuario) ?? 1) - 1;
        if (restantes > 0) reservadas.set(idUsuario, restantes);
        else reservadas.delete(idUsuario);
      }
      const id = idDe(versiones);
      cliente.escribir(
        evento('versiones', id, {
          versiones,
          recargar: ultimoEventoId !== undefined && ultimoEventoId !== id,
        }),
      );
      clientes.add(cliente);
      iniciarLatido();
      return () => {
        quitar(cliente);
      };
    },

    cerrarTodas() {
      for (const cliente of [...clientes]) quitar(cliente);
      for (const agrupacion of agrupaciones.values()) clearTimeout(agrupacion.temporizador);
    },
  };
}
