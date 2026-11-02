import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  api,
  clientesSembrados,
  limpiarCarritos,
  metodoEstandar,
  tokenDeAdmin,
  varianteConExistencia,
} from '../concurrencia/apoyo-concurrencia.js';
import { compose, esperar, RAIZ } from './apoyo-entorno.js';

// E9-H01 (RNF-4): la observabilidad en el entorno real. Sin el perfil `observabilidad`, la API atiende igual y
// cada señal registra una sola advertencia; con el perfil, una compra se encuentra como traza en Tempo, con sus
// logs en Loki. Cada caso corre según el perfil esté levantado o no.

const URL_BASE = process.env.SHOPCART_URL ?? 'http://localhost:8080';
const entorno = parseEnv(readFileSync(join(RAIZ, '.env'), 'utf8'));
const RED = process.env.RED_PREFIJO ?? entorno.RED_PREFIJO ?? '172.28.10';
const GRAFANA = `http://127.0.0.1:${process.env.GRAFANA_PUERTO ?? entorno.GRAFANA_PUERTO ?? '3001'}`;
const SENALES = ['trazas', 'metricas', 'logs'];
const LARGO_TRACE_ID = 32;

let perfilActivo = false;

beforeAll(async () => {
  const { stdout } = await compose('ps', 'otel-lgtm', '--format', '{{.State}}');
  perfilActivo = stdout.trim() === 'running';
});

const lineasDeLog = async (servicio: string) =>
  (await compose('logs', '--no-log-prefix', servicio)).stdout
    .split('\n')
    .filter((linea) => linea.startsWith('{'))
    .map((linea) =>
      z
        .looseObject({ msg: z.string().optional(), senal: z.string().optional() })
        .parse(JSON.parse(linea)),
    );

// Los logs del contenedor acumulan cada arranque (otras pruebas de entorno detienen y levantan la réplica):
// solo cuenta el proceso actual, lo que viene después del último apagado.
const delProcesoActual = <T extends { msg?: string | undefined }>(lineas: T[]): T[] =>
  lineas.slice(lineas.findLastIndex((l) => l.msg === 'API detenida') + 1);

const grafana = async (ruta: string, consulta: Record<string, string> = {}) => {
  const respuesta = await fetch(`${GRAFANA}${ruta}?${new URLSearchParams(consulta).toString()}`);
  return { status: respuesta.status, cuerpo: (await respuesta.json()) as unknown };
};

describe('observabilidad en el entorno real (E9-H01)', () => {
  it('el colector se resuelve a su IP fija de la subred, sin DNS (extra_hosts)', async () => {
    const { stdout } = await compose('exec', '-T', 'api-1', 'getent', 'hosts', 'otel-lgtm');

    expect(stdout.trim().split(/\s+/)[0]).toBe(`${RED}.40`);
  });

  it('sin el perfil, la API atiende y cada señal registra una sola advertencia, no una por lote', async (contexto) => {
    if (perfilActivo) contexto.skip();
    const salud = await fetch(`${URL_BASE}/api/v1/health`);
    const avisosDe = async (senal: string) => {
      const avisos = delProcesoActual(await lineasDeLog('api-1')).filter((l) => l.senal === senal);
      return {
        caidas: avisos.filter((l) => l.msg?.includes('no está disponible')).length,
        vueltas: avisos.filter((l) => l.msg?.includes('disponible otra vez')).length,
      };
    };
    // Si otra prueba acaba de levantar la réplica, su primera exportación (métricas: cada 15 s) aún no ocurrió.
    for (const senal of SENALES) {
      await esperar(async () => (await avisosDe(senal)).caidas >= 1, `la advertencia de ${senal}`);
    }

    expect(salud.status).toBe(200);
    for (const senal of SENALES) {
      const { caidas, vueltas } = await avisosDe(senal);
      expect(caidas).toBeLessThanOrEqual(vueltas + 1);
    }
  });

  it('con el perfil, el dashboard ShopCart está aprovisionado', async (contexto) => {
    if (!perfilActivo) contexto.skip();

    const { status, cuerpo } = await grafana('/api/dashboards/uid/shopcart');

    expect(status).toBe(200);
    expect(
      z.object({ dashboard: z.object({ title: z.string() }) }).parse(cuerpo).dashboard.title,
    ).toBe('ShopCart');
  });

  it('con el perfil, una compra es una traza en Tempo (petición → réplica → SPs → pasarela) con sus logs en Loki', async (contexto) => {
    if (!perfilActivo) contexto.skip();
    const tokenAdmin = await tokenDeAdmin();
    const [cliente] = await clientesSembrados(1);
    if (cliente === undefined) throw new Error('Falta el cliente sembrado');
    await limpiarCarritos([cliente]);
    const variante = await varianteConExistencia(tokenAdmin, 1);
    await api('POST', '/carrito/lineas', {
      token: cliente.token,
      cuerpo: { idVariante: variante.idVariante, cantidad: 1 },
    });
    await api('POST', '/checkout/sesion', {
      token: cliente.token,
      cuerpo: { idDireccion: cliente.idDireccion, idMetodoEnvio: await metodoEstandar() },
    });
    const pago = await fetch(`${URL_BASE}/api/v1/checkout/sesion/pagos`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cliente.token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        numeroTarjeta: '4242424242424242',
        mesVencimiento: 12,
        anioVencimiento: 2030,
        cvv: '123',
      }),
    });
    const requestId = pago.headers.get('x-request-id') ?? '';
    expect(pago.status).toBe(201);

    let traceId = '';
    await esperar(async () => {
      const { cuerpo } = await grafana('/api/datasources/proxy/uid/tempo/api/search', {
        q: `{ span.shopcart.request_id = "${requestId}" }`,
        limit: '1',
      });
      traceId =
        z.object({ traces: z.array(z.object({ traceID: z.string() })) }).parse(cuerpo).traces[0]
          ?.traceID ?? '';
      return traceId !== '';
    }, 'la traza del pago está en Tempo');
    const { cuerpo: traza } = await grafana(
      `/api/datasources/proxy/uid/tempo/api/traces/${traceId}`,
    );
    const lotes = z
      .object({
        batches: z.array(
          z.object({
            resource: z.object({
              attributes: z.array(
                z.object({ key: z.string(), value: z.record(z.string(), z.unknown()) }),
              ),
            }),
            scopeSpans: z.array(
              z.object({
                spans: z.array(
                  z.object({
                    name: z.string(),
                    attributes: z
                      .array(
                        z.object({ key: z.string(), value: z.record(z.string(), z.unknown()) }),
                      )
                      .default([]),
                  }),
                ),
              }),
            ),
          }),
        ),
      })
      .parse(traza).batches;
    const spans = lotes.flatMap((l) => l.scopeSpans.flatMap((s) => s.spans));
    const nombres = spans.map((sp) => sp.name);
    const procedimientos = spans.flatMap((sp) =>
      sp.attributes
        .filter((a) => a.key === 'db.stored_procedure.name')
        .map((a) => Object.values(a.value)[0]),
    );
    const replicas = new Set(
      lotes.flatMap((l) =>
        l.resource.attributes
          .filter((a) => a.key === 'service.instance.id')
          .map((a) => Object.values(a.value)[0]),
      ),
    );

    expect(nombres).toEqual(
      expect.arrayContaining([
        'POST /api/v1/checkout/sesion/pagos',
        'pasarela.autorizar',
        'pasarela.capturar',
      ]),
    );
    expect(procedimientos).toEqual(
      expect.arrayContaining(['SP_Checkout_RegistrarIntentoPago', 'SP_Pedidos_CrearPedido']),
    );
    expect([...replicas].every((r) => r === 'api-1' || r === 'api-2')).toBe(true);

    // Tempo omite los ceros iniciales del ID; Loki lo guarda con sus 32 caracteres.
    const traceIdCompleto = traceId.padStart(LARGO_TRACE_ID, '0');
    await esperar(async () => {
      const { cuerpo } = await grafana('/api/datasources/proxy/uid/loki/loki/api/v1/query_range', {
        query: `{service_name="shopcart-api"} | trace_id="${traceIdCompleto}"`,
        limit: '5',
      });
      return (
        z.object({ data: z.object({ result: z.array(z.unknown()) }) }).parse(cuerpo).data.result
          .length > 0
      );
    }, 'los logs de la traza están en Loki');
  });
});
