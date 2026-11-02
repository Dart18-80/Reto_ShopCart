import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';

const ejecutar = promisify(execFile);
const RAIZ_API = join(import.meta.dirname, '../..');
const ESPERA_ARRANQUE_MS = 30_000;
const INTERVALO_MS = 250;

const atributoSchema = z.object({
  key: z.string(),
  value: z.record(z.string(), z.unknown()),
});
const spanSchema = z.object({
  traceId: z.string(),
  name: z.string(),
  attributes: z.array(atributoSchema).default([]),
});
const logSchema = z.object({
  traceId: z.string().optional(),
  body: z.unknown(),
  attributes: z.array(atributoSchema).default([]),
});
const trazasSchema = z.object({
  resourceSpans: z.array(
    z.object({ scopeSpans: z.array(z.object({ spans: z.array(spanSchema) })) }),
  ),
});
const logsSchema = z.object({
  resourceLogs: z.array(
    z.object({ scopeLogs: z.array(z.object({ logRecords: z.array(logSchema) })) }),
  ),
});

export interface SpanRecibido {
  traceId: string;
  nombre: string;
  atributos: Record<string, unknown>;
}

export interface LogRecibido {
  traceId: string | undefined;
  texto: string;
}

const atributos = (lista: z.infer<typeof atributoSchema>[]) =>
  Object.fromEntries(lista.map(({ key, value }) => [key, Object.values(value)[0]]));

/**
 * E9-H01: un receptor OTLP/HTTP en memoria. Guarda lo que la API exporta, tal cual sale del proceso: es la
 * prueba de qué datos llegarían al colector.
 */
export async function receptorEnMemoria() {
  const spans: SpanRecibido[] = [];
  const logs: LogRecibido[] = [];
  const crudo: string[] = [];
  const servidor: Server = createServer((peticion, respuesta) => {
    const partes: Buffer[] = [];
    peticion.on('data', (parte: Buffer) => partes.push(parte));
    peticion.on('end', () => {
      const cuerpo = Buffer.concat(partes).toString();
      crudo.push(cuerpo);
      if (peticion.url === '/v1/traces') {
        for (const recurso of trazasSchema.parse(JSON.parse(cuerpo)).resourceSpans) {
          for (const alcance of recurso.scopeSpans) {
            for (const span of alcance.spans) {
              spans.push({
                traceId: span.traceId,
                nombre: span.name,
                atributos: atributos(span.attributes),
              });
            }
          }
        }
      } else if (peticion.url === '/v1/logs') {
        for (const recurso of logsSchema.parse(JSON.parse(cuerpo)).resourceLogs) {
          for (const alcance of recurso.scopeLogs) {
            for (const registro of alcance.logRecords) {
              logs.push({ traceId: registro.traceId, texto: JSON.stringify(registro) });
            }
          }
        }
      }
      respuesta.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
    });
  });
  const port = await escucharEnPuertoLibre(servidor);
  return {
    endpoint: `http://127.0.0.1:${String(port)}`,
    spans,
    logs,
    /** Todo lo recibido, sin interpretar (para buscar cualquier secreto). */
    crudo: () => crudo.join('\n'),
    cerrar: () =>
      new Promise<void>((resolver) => {
        servidor.close(() => {
          resolver();
        });
      }),
  };
}

async function escucharEnPuertoLibre(servidor: Server): Promise<number> {
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const direccion = servidor.address();
  if (direccion === null || typeof direccion === 'string')
    throw new Error('El servidor no escucha en TCP');
  return direccion.port;
}

async function puertoLibre(): Promise<number> {
  const servidor = createServer();
  const port = await escucharEnPuertoLibre(servidor);
  await new Promise((resolver) => servidor.close(resolver));
  return port;
}

export async function esperar(
  condicion: () => boolean | Promise<boolean>,
  limiteMs: number,
): Promise<void> {
  const fin = Date.now() + limiteMs;
  while (Date.now() < fin) {
    if (await condicion()) return;
    await new Promise((resolver) => setTimeout(resolver, INTERVALO_MS));
  }
  throw new Error('La condición no se cumplió a tiempo');
}

/**
 * La API compilada, arrancada como en la imagen (`node --import ./dist/telemetria.js dist/server.js`), contra
 * shopcart_test y la base de Redis de las pruebas, exportando al receptor.
 */
export async function levantarApiConTelemetria(endpoint: string) {
  // Como el Dockerfile: la API importa el `dist` de @shopcart/shared, que un clon nuevo todavía no tiene.
  await ejecutar('pnpm', ['--filter', '@shopcart/shared', 'build'], { cwd: RAIZ_API, shell: true });
  await ejecutar('npx', ['tsc', '-p', 'tsconfig.build.json'], { cwd: RAIZ_API, shell: true });
  const puerto = await puertoLibre();
  const proceso: ChildProcess = spawn(
    process.execPath,
    ['--import', './dist/telemetria.js', 'dist/server.js'],
    {
      cwd: RAIZ_API,
      env: {
        ...process.env,
        PUERTO: String(puerto),
        INSTANCIA_ID: 'telemetria',
        OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
        OTEL_SEMCONV_STABILITY_OPT_IN: 'http',
      },
      stdio: 'ignore',
    },
  );
  const url = `http://127.0.0.1:${String(puerto)}`;
  await esperar(async () => {
    const salud = await fetch(`${url}/api/v1/health`).catch(() => null);
    return salud?.status === 200;
  }, ESPERA_ARRANQUE_MS);
  return {
    url,
    detener: async () => {
      proceso.kill();
      await once(proceso, 'exit');
    },
  };
}
