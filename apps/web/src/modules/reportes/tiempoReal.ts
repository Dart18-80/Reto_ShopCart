import { DOMINIOS_REPORTES, type DominioReportes } from '@shopcart/shared';
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { z } from 'zod';
import { ErrorApi } from '../../shared/api';

/** E9-H02 (A-11): los dominios de datos del dashboard; cada uno tiene su versión. */
export type Dominio = DominioReportes;

/** En qué está la conexión; el indicador del dashboard lo muestra con texto (05 §11). */
export type EstadoTiempoReal = 'conectando' | 'en-vivo' | 'reconectando' | 'en-pausa';

export const ESPERA_MINIMA_MS = 1_000;
export const ESPERA_MAXIMA_MS = 30_000;
/** Dos latidos del backend (cada 15 s) más margen: sin recibir nada en este tiempo, la conexión está muerta. */
export const SILENCIO_MAXIMO_MS = 35_000;
/** Con 429 CONEXIONES_MAXIMAS (muchas pestañas abiertas) se espera más antes de volver a intentar. */
export const ESPERA_CONEXIONES_MAXIMAS_MS = 60_000;

const CODIGO_CONEXIONES_MAXIMAS = 'CONEXIONES_MAXIMAS';
// El cliente `api` ya intentó renovar ante un 401; un 403 es un rol que ya no es Administrador. En los dos casos la
// sesión cambió y reintentar no sirve: el guardián lleva al login o a «Sin permiso».
const STATUS_SIN_SESION = new Set([401, 403]);

// Lo que manda el backend (reportes.eventos.ts). Un evento que no cumple el contrato rompe la conexión.
const versionesSchema = z.object({
  versiones: z.object({ ventas: z.number().int(), carritos: z.number().int() }),
  recargar: z.boolean(),
});
const cambioSchema = z.object({ dominio: z.enum(DOMINIOS_REPORTES), version: z.number().int() });

interface Dependencias {
  /** Abre el stream con el `Last-Event-ID` conocido; lanza ErrorApi si el backend lo rechaza. */
  abrir: (ultimoEventoId: string | null, senal: AbortSignal) => Promise<ReadableStream<Uint8Array>>;
  alCambio: (dominio: Dominio) => void;
  /** Al abrir el stream: todo el dashboard se vuelve a pedir una vez. */
  alRecargar: () => void;
  alEstado: (estado: EstadoTiempoReal) => void;
  /** Entre 0 y 1; las pruebas lo fijan. */
  aleatorio?: () => number;
}

export interface TiempoReal {
  /** Conecta (al abrir el dashboard o al volver a la pestaña). */
  reanudar(): void;
  /** Cierra la conexión sin reintentar (la pestaña se ocultó). */
  pausar(): void;
  /** Cierra todo para siempre (al salir del dashboard). */
  detener(): void;
}

/**
 * FE-11 (05 §11): el bucle de conexión del stream del dashboard. Solo recibe avisos («cambió ventas»): quien lo usa
 * vuelve a pedir los reportes de ese dominio. Reconecta con espera creciente y aleatoria, vigila el latido y no
 * conoce la sesión: el token y su renovación los pone `abrir` (el cliente `api`, 05 §5).
 */
export function crearTiempoReal({
  abrir,
  alCambio,
  alRecargar,
  alEstado,
  aleatorio = Math.random,
}: Dependencias): TiempoReal {
  const conocidas: Record<Dominio, number> = { ventas: 0, carritos: 0 };
  let ultimoEventoId: string | null = null;
  let intentos = 0;
  let conexion: AbortController | undefined;
  let reintento: ReturnType<typeof setTimeout> | undefined;
  let vigilante: ReturnType<typeof setTimeout> | undefined;
  let detenido = false;

  const avisar = (estado: EstadoTiempoReal) => {
    if (!detenido) alEstado(estado);
  };

  function cortar(): void {
    clearTimeout(reintento);
    clearTimeout(vigilante);
    reintento = undefined;
    conexion?.abort();
    conexion = undefined;
  }

  function programar(espera: number, estado: EstadoTiempoReal): void {
    cortar();
    avisar(estado);
    reintento = setTimeout(() => {
      void conectar();
    }, espera);
  }

  // Entre 1 s y un tope que se duplica con cada intento (2 s, 4 s…, hasta 30 s). También el primero es aleatorio:
  // cuando una réplica se apaga o los tokens vencen a la vez, las pestañas no reconectan todas en el mismo instante.
  function reconectar(): void {
    const tope = Math.min(ESPERA_MAXIMA_MS, ESPERA_MINIMA_MS * 2 ** (intentos + 1));
    intentos++;
    programar(ESPERA_MINIMA_MS + aleatorio() * (tope - ESPERA_MINIMA_MS), 'reconectando');
  }

  function vigilar(): void {
    clearTimeout(vigilante);
    vigilante = setTimeout(reconectar, SILENCIO_MAXIMO_MS);
  }

  function alEvento({ event, id, data }: EventSourceMessage): void {
    if (event === 'versiones') {
      const { versiones } = versionesSchema.parse(JSON.parse(data));
      Object.assign(conocidas, versiones);
      intentos = 0;
      avisar('en-vivo');
      // Cada apertura (la primera y cada reconexión) invalida una vez todo el dashboard, aunque el backend diga
      // recargar: false: lo que cambió antes de abrir o mientras estuvo desconectado no espera al siguiente aviso.
      alRecargar();
    } else if (event === 'cambio') {
      const { dominio, version } = cambioSchema.parse(JSON.parse(data));
      if (version <= conocidas[dominio]) return;
      conocidas[dominio] = version;
      alCambio(dominio);
    }
    if (id !== undefined) ultimoEventoId = id;
  }

  async function leer(cuerpo: ReadableStream<Uint8Array>): Promise<void> {
    const decodificador = new TextDecoder();
    const parser = createParser({ onEvent: alEvento });
    const lector = cuerpo.getReader();
    for (;;) {
      const { done, value } = await lector.read();
      if (done) return;
      // Cualquier cosa que llegue, también el comentario del latido, prueba que la conexión vive.
      vigilar();
      parser.feed(decodificador.decode(value, { stream: true }));
    }
  }

  async function conectar(): Promise<void> {
    cortar();
    const actual = new AbortController();
    conexion = actual;
    // Desde que se pide: una petición que nunca responde (un proxy o una red a medias) también se da por muerta.
    vigilar();
    try {
      const cuerpo = await abrir(ultimoEventoId, actual.signal);
      await leer(cuerpo);
    } catch (error) {
      // Cortada a propósito (pausa, vigilante, otra conexión): quien la cortó decide qué sigue.
      if (actual.signal.aborted) return;
      fallar(error);
      return;
    }
    // El backend cerró el stream: venció el token o la réplica se apaga. Se reconecta por el camino normal.
    if (!actual.signal.aborted) reconectar();
  }

  function fallar(error: unknown): void {
    if (error instanceof ErrorApi && error.codigo === CODIGO_CONEXIONES_MAXIMAS) {
      programar(ESPERA_CONEXIONES_MAXIMAS_MS, 'en-pausa');
      return;
    }
    if (error instanceof ErrorApi && STATUS_SIN_SESION.has(error.status)) {
      cortar();
      avisar('en-pausa');
      return;
    }
    reconectar();
  }

  return {
    reanudar() {
      if (detenido) return;
      avisar(ultimoEventoId === null ? 'conectando' : 'reconectando');
      void conectar();
    },
    pausar() {
      cortar();
      avisar('en-pausa');
    },
    detener() {
      detenido = true;
      cortar();
    },
  };
}
