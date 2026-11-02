import { pino } from 'pino';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  crearDifusorDeVersiones,
  INTERVALO_LATIDO_MS,
  MAX_CONEXIONES_POR_USUARIO,
  VENTANA_AGRUPACION_MS,
  type ClienteDeEventos,
} from '../../../../src/modules/reportes/reportes.eventos.js';
import type { OyenteDeAvisos } from '../../../../src/shared/avisos/index.js';
import { usarTelemetriaEnMemoria } from '../../telemetria-en-memoria.js';

const telemetria = usarTelemetriaEnMemoria();
const UNA_HORA_MS = 3_600_000;

function preparar(versiones: Record<string, number> = { ventas: 3, carritos: 7 }) {
  const actuales = { ...versiones };
  let oyente: OyenteDeAvisos | undefined;
  const difusor = crearDifusorDeVersiones({
    cache: {
      contador: vi.fn((clave: string) => Promise.resolve(actuales[clave.split(':')[1] ?? ''] ?? 0)),
    },
    avisos: {
      publicar: () => Promise.resolve(),
      suscribir: (nuevo) => {
        oyente = nuevo;
      },
    },
    logger: pino({ level: 'silent' }),
  });
  const avisar = (dominio: string, version: number) => {
    actuales[dominio] = version;
    oyente?.alRecibir({ dominio, version });
  };
  return { difusor, avisar, actuales, reconectar: () => oyente?.alReconectar() };
}

function cliente(cambios: Partial<Pick<ClienteDeEventos, 'idUsuario' | 'venceEn'>> = {}) {
  const escrito: string[] = [];
  const nuevo = {
    idUsuario: 1,
    venceEn: new Date(Date.now() + UNA_HORA_MS),
    sesionVigente: vi.fn(() => Promise.resolve(true)),
    escribir: vi.fn((texto: string) => {
      escrito.push(texto);
    }),
    cerrar: vi.fn(),
    ...cambios,
  };
  return { ...nuevo, escrito, eventos: () => escrito.filter((t) => t.startsWith('id:')) };
}

/** Lo que dice un evento SSE: su id, su nombre y sus datos. */
function leer(evento: string | undefined) {
  const campos = Object.fromEntries(
    (evento ?? '')
      .trim()
      .split('\n')
      .map((linea) => [linea.slice(0, linea.indexOf(':')), linea.slice(linea.indexOf(':') + 2)]),
  );
  return {
    id: campos.id,
    evento: campos.event,
    datos: JSON.parse(campos.data ?? 'null') as unknown,
  };
}

describe('difusor de versiones del dashboard (E9-H02, A-25)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('al conectar envía las versiones actuales, con ellas como id', async () => {
    const { difusor } = preparar();
    const admin = cliente();

    await difusor.conectar(admin);

    expect(leer(admin.eventos()[0])).toEqual({
      id: 'ventas3.carritos7',
      evento: 'versiones',
      datos: { versiones: { ventas: 3, carritos: 7 }, recargar: false },
    });
  });

  it('con un Last-Event-ID distinto de las versiones actuales, el evento inicial pide recargar', async () => {
    const { difusor } = preparar();
    const igual = cliente();
    const atrasado = cliente();

    await difusor.conectar(igual, 'ventas3.carritos7');
    await difusor.conectar(atrasado, 'ventas2.carritos7');

    expect(leer(igual.eventos()[0]).datos).toMatchObject({ recargar: false });
    expect(leer(atrasado.eventos()[0]).datos).toMatchObject({ recargar: true });
  });

  it('un aviso de otra réplica llega como evento con la versión nueva en el id', async () => {
    const { difusor, avisar } = preparar();
    const admin = cliente();
    await difusor.conectar(admin);

    avisar('ventas', 4);

    expect(leer(admin.eventos()[1])).toEqual({
      id: 'ventas4.carritos7',
      evento: 'cambio',
      datos: { dominio: 'ventas', version: 4 },
    });
  });

  it('una ráfaga produce como máximo un evento por dominio en la ventana, y el último al cerrarla', async () => {
    const { difusor, avisar } = preparar();
    const admin = cliente();
    await difusor.conectar(admin);

    for (let version = 4; version <= 20; version++) avisar('ventas', version);
    avisar('carritos', 8);
    const enLaVentana = admin.eventos().length;
    await vi.advanceTimersByTimeAsync(VENTANA_AGRUPACION_MS);

    expect(enLaVentana).toBe(3);
    expect(
      admin
        .eventos()
        .slice(1)
        .map((e) => leer(e).datos),
    ).toEqual([
      { dominio: 'ventas', version: 4 },
      { dominio: 'carritos', version: 8 },
      { dominio: 'ventas', version: 20 },
    ]);
  });

  it('cada intervalo envía un latido como comentario SSE', async () => {
    const { difusor } = preparar();
    const admin = cliente();
    await difusor.conectar(admin);

    await vi.advanceTimersByTimeAsync(INTERVALO_LATIDO_MS * 2);

    expect(admin.escrito.filter((t) => t.startsWith(':'))).toHaveLength(2);
  });

  it('cierra el stream cuando vence el access token', async () => {
    const { difusor } = preparar();
    const admin = cliente({ venceEn: new Date(Date.now() + INTERVALO_LATIDO_MS / 2) });
    await difusor.conectar(admin);

    await vi.advanceTimersByTimeAsync(INTERVALO_LATIDO_MS);

    expect(admin.cerrar).toHaveBeenCalledTimes(1);
  });

  it('cierra el stream cuando cambia la versión de sesión del usuario (A-07)', async () => {
    const { difusor } = preparar();
    const admin = cliente();
    await difusor.conectar(admin);
    admin.sesionVigente.mockResolvedValue(false);

    await vi.advanceTimersByTimeAsync(INTERVALO_LATIDO_MS);

    expect(admin.cerrar).toHaveBeenCalledTimes(1);
  });

  it('más del máximo de conexiones del mismo usuario en la réplica responde 429; al desconectar se libera', async () => {
    const { difusor } = preparar();
    const desconexiones = [];
    for (let i = 0; i < MAX_CONEXIONES_POR_USUARIO; i++)
      desconexiones.push(await difusor.conectar(cliente()));

    await expect(difusor.conectar(cliente())).rejects.toMatchObject({
      codigo: 'CONEXIONES_MAXIMAS',
      status: 429,
    });
    await expect(difusor.conectar(cliente({ idUsuario: 2 }))).resolves.toBeTypeOf('function');
    desconexiones[0]?.();
    await expect(difusor.conectar(cliente())).resolves.toBeTypeOf('function');
  });

  it('al apagarse cierra todos los streams, para que el cliente reconecte a la otra réplica', async () => {
    const { difusor } = preparar();
    const uno = cliente();
    const otro = cliente({ idUsuario: 2 });
    await difusor.conectar(uno);
    await difusor.conectar(otro);

    difusor.cerrarTodas();

    expect([uno.cerrar.mock.calls.length, otro.cerrar.mock.calls.length]).toEqual([1, 1]);
  });

  it('cuando el canal vuelve después de una caída, envía las versiones actuales', async () => {
    const { difusor, actuales, reconectar } = preparar();
    const admin = cliente();
    await difusor.conectar(admin);
    actuales.ventas = 9;

    reconectar();
    await vi.advanceTimersByTimeAsync(0);

    expect(leer(admin.eventos().at(-1))).toMatchObject({
      id: 'ventas9.carritos7',
      evento: 'versiones',
      datos: { versiones: { ventas: 9, carritos: 7 } },
    });
  });

  it('cada difusión es un span con el dominio, la versión y cuántos clientes la recibieron', async () => {
    const { difusor, avisar } = preparar();
    await difusor.conectar(cliente());
    await difusor.conectar(cliente({ idUsuario: 2 }));

    avisar('carritos', 8);
    await vi.advanceTimersByTimeAsync(0);

    const [span] = telemetria.spans().filter((s) => s.name === 'sse.difundir');
    expect(span?.attributes).toMatchObject({
      'shopcart.sse.dominio': 'carritos',
      'shopcart.sse.version': 8,
      'shopcart.sse.clientes': 2,
    });
  });
});
