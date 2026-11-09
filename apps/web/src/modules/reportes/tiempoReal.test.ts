import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorApi } from '../../shared/api';
import {
  crearTiempoReal,
  ESPERA_CONEXIONES_MAXIMAS_MS,
  ESPERA_MAXIMA_MS,
  ESPERA_MINIMA_MS,
  SILENCIO_MAXIMO_MS,
  type Dominio,
  type EstadoTiempoReal,
} from './tiempoReal';

/** Un stream SSE que la prueba escribe a mano; al abortarse la petición, falla como lo hace fetch. */
function streamSimulado(senal: AbortSignal) {
  const codificador = new TextEncoder();
  let control!: ReadableStreamDefaultController<Uint8Array>;
  const cuerpo = new ReadableStream<Uint8Array>({
    start(controlador) {
      control = controlador;
    },
  });
  senal.addEventListener('abort', () => {
    control.error(new DOMException('La petición se canceló.', 'AbortError'));
  });
  return {
    cuerpo,
    enviar: (texto: string) => {
      control.enqueue(codificador.encode(texto));
    },
    cerrar: () => {
      control.close();
    },
  };
}

type Stream = ReturnType<typeof streamSimulado>;

const versiones = (id: string, ventas: number, carritos: number, recargar = false) =>
  `id: ${id}\nevent: versiones\ndata: ${JSON.stringify({ versiones: { ventas, carritos }, recargar })}\n\n`;
const cambio = (id: string, dominio: Dominio, version: number) =>
  `id: ${id}\nevent: cambio\ndata: ${JSON.stringify({ dominio, version })}\n\n`;
const LATIDO = ': latido\n\n';

function preparar({ aleatorio = () => 0 }: { aleatorio?: () => number } = {}) {
  const streams: Stream[] = [];
  const ultimosIds: (string | null)[] = [];
  const fallas: Error[] = [];
  let colgadas = 0;
  const abrir = vi.fn((ultimoEventoId: string | null, senal: AbortSignal) => {
    ultimosIds.push(ultimoEventoId);
    if (colgadas > 0) {
      colgadas--;
      // Sin respuesta ni error (un proxy o una red a medias): solo termina si se aborta.
      return new Promise<ReadableStream<Uint8Array>>((_, rechazar) => {
        senal.addEventListener('abort', () => {
          rechazar(new DOMException('La petición se canceló.', 'AbortError'));
        });
      });
    }
    const falla = fallas.shift();
    if (falla !== undefined) return Promise.reject(falla);
    const stream = streamSimulado(senal);
    streams.push(stream);
    return Promise.resolve(stream.cuerpo);
  });
  const cambios: Dominio[] = [];
  const estados: EstadoTiempoReal[] = [];
  let recargas = 0;
  const tiempoReal = crearTiempoReal({
    abrir,
    alCambio: (dominio) => cambios.push(dominio),
    alRecargar: () => {
      recargas++;
    },
    alEstado: (estado) => estados.push(estado),
    aleatorio,
  });
  return {
    tiempoReal,
    abrir,
    streams,
    ultimosIds,
    cambios,
    estados,
    recargas: () => recargas,
    /** La próxima conexión falla con este error. */
    fallar: (error: Error) => fallas.push(error),
    /** La próxima conexión nunca responde. */
    colgar: () => {
      colgadas++;
    },
    ultimo: () => {
      const stream = streams.at(-1);
      if (!stream) throw new Error('No se abrió ningún stream');
      return stream;
    },
    estado: () => estados.at(-1),
  };
}

const conexionesMaximas = () =>
  new ErrorApi({
    status: 429,
    codigo: 'CONEXIONES_MAXIMAS',
    mensaje: 'Demasiadas conexiones.',
    detalles: undefined,
    requestId: 'req-1',
  });
const sinSesion = () =>
  new ErrorApi({
    status: 401,
    codigo: 'NO_AUTENTICADO',
    mensaje: 'Inicia sesión.',
    detalles: undefined,
    requestId: 'req-2',
  });

// Deja correr las promesas pendientes (la lectura del stream) sin adelantar el reloj.
const procesar = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('crearTiempoReal (FE-11, M11-H02)', () => {
  it('al abrir el stream queda «En vivo» e invalida una vez todo el dashboard', async () => {
    const p = preparar();
    p.tiempoReal.reanudar();
    await procesar();
    expect(p.estado()).toBe('conectando');

    p.ultimo().enviar(versiones('ventas3.carritos7', 3, 7));
    await procesar();

    expect(p.estado()).toBe('en-vivo');
    // Lo que cambió entre la primera lectura de los reportes y la apertura no espera al siguiente aviso.
    expect(p.recargas()).toBe(1);
    expect(p.cambios).toEqual([]);
    expect(p.ultimosIds).toEqual([null]);
  });

  it('un cambio invalida solo su dominio; una versión menor o igual a la conocida se ignora', async () => {
    const p = preparar();
    p.tiempoReal.reanudar();
    await procesar();
    p.ultimo().enviar(versiones('ventas3.carritos7', 3, 7));

    p.ultimo().enviar(cambio('ventas4.carritos7', 'ventas', 4));
    p.ultimo().enviar(cambio('ventas4.carritos7', 'ventas', 4));
    p.ultimo().enviar(cambio('ventas4.carritos6', 'carritos', 6));
    p.ultimo().enviar(cambio('ventas4.carritos8', 'carritos', 8));
    await procesar();

    expect(p.cambios).toEqual(['ventas', 'carritos']);
  });

  it('con «recargar» también se invalida una sola vez', async () => {
    const p = preparar();
    p.tiempoReal.reanudar();
    await procesar();

    p.ultimo().enviar(versiones('ventas9.carritos7', 9, 7, true));
    await procesar();

    expect(p.recargas()).toBe(1);
  });

  it('un cambio durante la desconexión aparece al reconectar: cada apertura invalida una vez', async () => {
    const p = preparar();
    p.tiempoReal.reanudar();
    await procesar();
    p.ultimo().enviar(versiones('ventas3.carritos7', 3, 7));
    await procesar();

    p.ultimo().cerrar();
    await procesar();
    await vi.advanceTimersByTimeAsync(ESPERA_MINIMA_MS);
    // El backend no siempre sabe que el cliente se perdió algo (recargar: false): la apertura invalida igual.
    p.ultimo().enviar(versiones('ventas3.carritos7', 3, 7));
    await procesar();

    expect(p.recargas()).toBe(2);
  });

  it('el cierre por token vencido es normal: reconecta en 1 s con Last-Event-ID', async () => {
    const p = preparar();
    p.tiempoReal.reanudar();
    await procesar();
    p.ultimo().enviar(versiones('ventas3.carritos7', 3, 7));
    p.ultimo().enviar(cambio('ventas4.carritos7', 'ventas', 4));
    await procesar();

    p.ultimo().cerrar();
    await procesar();
    expect(p.estado()).toBe('reconectando');
    await vi.advanceTimersByTimeAsync(ESPERA_MINIMA_MS - 1);
    expect(p.abrir).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);

    expect(p.abrir).toHaveBeenCalledTimes(2);
    expect(p.ultimosIds).toEqual([null, 'ventas4.carritos7']);
  });

  it('la espera crece hasta 30 s mientras falla y vuelve a la del primer intento tras conectar', async () => {
    // aleatorio = 1: la espera es el tope de cada intento.
    const p = preparar({ aleatorio: () => 1 });
    const errorDeRed = ErrorApi.deRed();
    for (let i = 0; i < 7; i++) p.fallar(errorDeRed);
    p.tiempoReal.reanudar();
    await procesar();

    const esperas: number[] = [];
    let llamadas = p.abrir.mock.calls.length;
    while (llamadas < 8) {
      let espera = 0;
      while (p.abrir.mock.calls.length === llamadas) {
        await vi.advanceTimersByTimeAsync(1000);
        espera += 1000;
      }
      esperas.push(espera);
      llamadas = p.abrir.mock.calls.length;
    }
    expect(esperas).toEqual([
      2000,
      4000,
      8000,
      16000,
      ESPERA_MAXIMA_MS,
      ESPERA_MAXIMA_MS,
      ESPERA_MAXIMA_MS,
    ]);

    p.ultimo().enviar(versiones('ventas1.carritos1', 1, 1));
    await procesar();
    p.ultimo().cerrar();
    await procesar();
    await vi.advanceTimersByTimeAsync(2 * ESPERA_MINIMA_MS - 1);
    expect(p.abrir).toHaveBeenCalledTimes(8);
    await vi.advanceTimersByTimeAsync(1);
    expect(p.abrir).toHaveBeenCalledTimes(9);
  });

  it('la espera es aleatoria entre 1 s y su tope, también la primera: las pestañas no reconectan juntas', async () => {
    const p = preparar({ aleatorio: () => 0.5 });
    p.fallar(ErrorApi.deRed());
    p.fallar(ErrorApi.deRed());
    p.tiempoReal.reanudar();
    await procesar();

    // Primer intento: tope de 2 s, la mitad del camino entre 1 s y 2 s.
    await vi.advanceTimersByTimeAsync(1499);
    expect(p.abrir).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(p.abrir).toHaveBeenCalledTimes(2);

    // Segundo intento: tope de 4 s, la mitad del camino entre 1 s y 4 s.
    await vi.advanceTimersByTimeAsync(2499);
    expect(p.abrir).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(p.abrir).toHaveBeenCalledTimes(3);
  });

  it('una conexión que nunca responde también la corta el vigilante y se reintenta', async () => {
    const p = preparar();
    p.colgar();
    p.tiempoReal.reanudar();
    await procesar();

    await vi.advanceTimersByTimeAsync(SILENCIO_MAXIMO_MS);
    expect(p.estado()).toBe('reconectando');
    await vi.advanceTimersByTimeAsync(ESPERA_MINIMA_MS);
    expect(p.abrir).toHaveBeenCalledTimes(2);
  });

  it('el vigilante: más de 35 s sin recibir nada da la conexión por muerta y la reabre', async () => {
    const p = preparar();
    p.tiempoReal.reanudar();
    await procesar();
    p.ultimo().enviar(versiones('ventas3.carritos7', 3, 7));
    await procesar();

    await vi.advanceTimersByTimeAsync(SILENCIO_MAXIMO_MS - 1);
    p.ultimo().enviar(LATIDO);
    await vi.advanceTimersByTimeAsync(SILENCIO_MAXIMO_MS - 1);
    expect(p.abrir).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(p.estado()).toBe('reconectando');
    await vi.advanceTimersByTimeAsync(ESPERA_MINIMA_MS);
    expect(p.abrir).toHaveBeenCalledTimes(2);
    expect(p.ultimosIds.at(-1)).toBe('ventas3.carritos7');
  });

  it('429 CONEXIONES_MAXIMAS: «En pausa» y reintento con espera larga', async () => {
    const p = preparar();
    p.fallar(conexionesMaximas());
    p.tiempoReal.reanudar();
    await procesar();

    expect(p.estado()).toBe('en-pausa');
    await vi.advanceTimersByTimeAsync(ESPERA_CONEXIONES_MAXIMAS_MS - 1);
    expect(p.abrir).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(p.abrir).toHaveBeenCalledTimes(2);
  });

  it('un 401 que la renovación no pudo resolver deja de intentar: la sesión se cerró', async () => {
    const p = preparar();
    p.fallar(sinSesion());
    p.tiempoReal.reanudar();
    await procesar();

    expect(p.estado()).toBe('en-pausa');
    await vi.advanceTimersByTimeAsync(ESPERA_CONEXIONES_MAXIMAS_MS * 2);
    expect(p.abrir).toHaveBeenCalledTimes(1);
  });

  it('un 403 (el rol ya no es Administrador) tampoco se reintenta: queda en pausa', async () => {
    const p = preparar();
    p.fallar(
      new ErrorApi({
        status: 403,
        codigo: 'SIN_PERMISO',
        mensaje: 'No tienes permiso.',
        detalles: undefined,
        requestId: 'req-3',
      }),
    );
    p.tiempoReal.reanudar();
    await procesar();

    expect(p.estado()).toBe('en-pausa');
    await vi.advanceTimersByTimeAsync(ESPERA_CONEXIONES_MAXIMAS_MS * 2);
    expect(p.abrir).toHaveBeenCalledTimes(1);
  });

  it('un evento con datos que no son del contrato se trata como una conexión rota', async () => {
    const p = preparar();
    p.tiempoReal.reanudar();
    await procesar();

    p.ultimo().enviar('event: cambio\ndata: {"dominio":"otro","version":1}\n\n');
    await procesar();

    expect(p.cambios).toEqual([]);
    expect(p.estado()).toBe('reconectando');
  });

  it('con la pestaña oculta se pausa sin reconectar; al volver, reconecta con Last-Event-ID', async () => {
    const p = preparar();
    p.tiempoReal.reanudar();
    await procesar();
    p.ultimo().enviar(versiones('ventas3.carritos7', 3, 7));
    await procesar();

    p.tiempoReal.pausar();
    await procesar();
    expect(p.estado()).toBe('en-pausa');
    await vi.advanceTimersByTimeAsync(SILENCIO_MAXIMO_MS * 2);
    expect(p.abrir).toHaveBeenCalledTimes(1);

    p.tiempoReal.reanudar();
    await procesar();
    expect(p.abrir).toHaveBeenCalledTimes(2);
    expect(p.ultimosIds.at(-1)).toBe('ventas3.carritos7');
  });

  it('detenido (al salir del dashboard) no vuelve a conectar ni avisa nada', async () => {
    const p = preparar();
    p.tiempoReal.reanudar();
    await procesar();
    const avisados = p.estados.length;

    p.tiempoReal.detener();
    await vi.advanceTimersByTimeAsync(ESPERA_MAXIMA_MS * 2);

    expect(p.abrir).toHaveBeenCalledTimes(1);
    expect(p.estados).toHaveLength(avisados);
  });
});
