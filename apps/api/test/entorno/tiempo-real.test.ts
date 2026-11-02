import { describe, expect, it } from 'vitest';
import {
  api,
  clientesSembrados,
  limpiarCarritos,
  tokenDeAdmin,
  varianteConExistencia,
} from '../concurrencia/apoyo-concurrencia.js';
import { compose, esperar, levantar } from './apoyo-entorno.js';

// E9-H02 (A-25): el stream del dashboard a través de nginx, con las dos réplicas y Redis reales.

const URL_BASE = process.env.SHOPCART_URL ?? 'http://localhost:8080';
const RUTA = '/api/v1/admin/reportes/eventos';
// La API envía un latido cada 15 s: con margen.
const ESPERA_LATIDO_MS = 20_000;

async function abrir(token: string) {
  const controlador = new AbortController();
  const respuesta = await fetch(`${URL_BASE}${RUTA}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: controlador.signal,
  });
  const recibido: string[] = [];
  let cerrado = false;
  const leyendo = (async () => {
    if (respuesta.body === null) return;
    const decodificador = new TextDecoder();
    try {
      for await (const parte of respuesta.body) recibido.push(decodificador.decode(parte));
    } catch {
      // Se abortó al terminar la prueba.
    }
    cerrado = true;
  })();
  const texto = () => recibido.join('');
  return {
    respuesta,
    instancia: respuesta.headers.get('x-instancia') ?? '',
    eventos: () =>
      texto()
        .split('\n\n')
        .filter((e) => e.startsWith('id:')),
    latidos: () =>
      texto()
        .split('\n\n')
        .filter((e) => e.startsWith(':')).length,
    cerrado: () => cerrado,
    cerrar: async () => {
      controlador.abort();
      await leyendo;
    },
  };
}

const verdad = (condicion: () => boolean) => () => Promise.resolve(condicion());

describe('dashboard en tiempo real a través de nginx (E9-H02)', () => {
  it('el primer evento llega sin buffering y un cambio en un carrito llega como evento, sin importar la réplica', async () => {
    const stream = await abrir(await tokenDeAdmin());
    await esperar(
      verdad(() => stream.eventos().length === 1),
      'el evento inicial',
    );
    const [cliente] = await clientesSembrados(1);
    if (cliente === undefined) throw new Error('Falta el cliente sembrado');
    await limpiarCarritos([cliente]);
    const variante = await varianteConExistencia(await tokenDeAdmin(), 5);

    await api('POST', '/carrito/lineas', {
      token: cliente.token,
      cuerpo: { idVariante: variante.idVariante, cantidad: 1 },
    });
    await esperar(
      verdad(() => stream.eventos().some((e) => e.includes('"dominio":"carritos"'))),
      'el evento de carritos',
    );
    await stream.cerrar();

    expect(stream.respuesta.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(['api-1', 'api-2']).toContain(stream.instancia);
  });

  it(
    'con Redis detenido el stream sigue abierto (latidos) y al volver llegan las versiones actuales',
    async () => {
      const stream = await abrir(await tokenDeAdmin());
      await esperar(
        verdad(() => stream.eventos().length === 1),
        'el evento inicial',
      );

      await compose('stop', 'redis');
      try {
        const latidosAntes = stream.latidos();
        await esperar(
          verdad(() => stream.latidos() > latidosAntes),
          'un latido con Redis detenido',
        );
        expect(stream.cerrado()).toBe(false);
      } finally {
        await levantar('redis');
      }
      await esperar(
        verdad(() =>
          stream
            .eventos()
            .slice(1)
            .some((e) => e.includes('event: versiones')),
        ),
        'las versiones al volver Redis',
      );
      await stream.cerrar();

      expect(stream.eventos().at(-1)).toMatch(/"recargar":true/);
    },
    ESPERA_LATIDO_MS * 4,
  );

  it('al detener la réplica (SIGTERM) su stream se cierra enseguida, para que el cliente reconecte a la otra', async () => {
    const stream = await abrir(await tokenDeAdmin());
    await esperar(
      verdad(() => stream.eventos().length === 1),
      'el evento inicial',
    );

    const inicio = Date.now();
    let duracion: number | undefined;
    await compose('stop', stream.instancia);
    try {
      await esperar(verdad(stream.cerrado), 'el cierre del stream');
      duracion = Date.now() - inicio;
    } finally {
      await levantar(stream.instancia);
    }

    // Por debajo de la espera máxima del apagado ordenado (10 s): el stream no la agotó.
    expect(duracion).toBeLessThan(10_000);
  }, 120_000);
});
