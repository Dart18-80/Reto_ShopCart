import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { cargarConfiguracion } from '../../src/shared/config/index.js';
import { CONTRASENA } from '../integracion/auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../integracion/base-de-pruebas.js';
import { varianteVendible } from '../integracion/carrito/apoyo-carrito.js';
import { TARJETA_APROBADA } from '../integracion/checkout/apoyo-checkout.js';
import {
  esperar,
  levantarApiConTelemetria,
  receptorEnMemoria,
  type SpanRecibido,
} from './api-con-telemetria.js';

// E9-H01: la API compilada, arrancada igual que en la imagen (`--import ./dist/telemetria.js`), con las
// instrumentaciones reales, exporta a un receptor en memoria. Se recorre registro, login, perfil, refresh,
// carrito y un pago con tarjeta (Redis real, con AUTH) y se revisa todo lo que salió del proceso.

usarBaseDePruebas();

const ESPERA_EXPORTACION_MS = 20_000;
const CVV = '731';
const config = cargarConfiguracion(process.env);
const receptor = await receptorEnMemoria();
let api: Awaited<ReturnType<typeof levantarApiConTelemetria>>;
const secretos: string[] = [];
let correo = '';
let requestIdDelPago = '';

const sobreSchema = z.object({ datos: z.unknown() });
const datos = <T>(esquema: z.ZodType<T>, cuerpo: unknown): T =>
  esquema.parse(sobreSchema.parse(cuerpo).datos);

interface Opciones {
  token?: string;
  cookie?: string;
  cuerpo?: object;
  encabezados?: Record<string, string>;
}

async function llamar(metodo: string, ruta: string, opciones: Opciones = {}): Promise<Response> {
  const encabezados: Record<string, string> = { ...opciones.encabezados };
  if (opciones.token !== undefined) encabezados.Authorization = `Bearer ${opciones.token}`;
  if (opciones.cookie !== undefined) encabezados.Cookie = opciones.cookie;
  if (opciones.cuerpo !== undefined) encabezados['Content-Type'] = 'application/json';
  return fetch(`${api.url}/api/v1${ruta}`, {
    method: metodo,
    headers: encabezados,
    body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
  });
}

const leer = async (respuesta: Promise<Response>): Promise<unknown> => (await respuesta).json();

beforeAll(async () => {
  api = await levantarApiConTelemetria(receptor.endpoint);
  correo = `traza-${randomUUID().slice(0, 8)}@ejemplo.gt`;

  await llamar('POST', '/auth/registro', {
    cuerpo: { correo, contrasena: CONTRASENA, nombre: 'Traza' },
  });
  const login = await llamar('POST', '/auth/login', { cuerpo: { correo, contrasena: CONTRASENA } });
  const { accessToken } = datos(z.object({ accessToken: z.string() }), await login.json());
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  await llamar('GET', '/usuarios/me', { token: accessToken });
  await llamar('POST', '/auth/refresh', { cookie });

  const { IDVariante } = await varianteVendible('25.00', 5);
  await llamar('POST', '/carrito/lineas', {
    token: accessToken,
    cuerpo: { idVariante: IDVariante, cantidad: 1 },
  });
  const [departamento] = datos(
    z.array(z.object({ idDepartamento: z.number() })),
    await leer(llamar('GET', '/departamentos')),
  );
  const [municipio] = datos(
    z.array(z.object({ idMunicipio: z.number() })),
    await leer(llamar('GET', `/departamentos/${String(departamento?.idDepartamento)}/municipios`)),
  );
  const { idDireccion } = datos(
    z.object({ idDireccion: z.number() }),
    await leer(
      llamar('POST', '/direcciones', {
        token: accessToken,
        cuerpo: {
          nombreRecibe: 'Ana Traza',
          telefonoRecibe: '55554444',
          idMunicipio: municipio?.idMunicipio,
          direccionLinea: '5a avenida 10-20',
        },
      }),
    ),
  );
  const { metodos } = datos(
    z.object({ metodos: z.array(z.object({ idMetodoEnvio: z.number() })) }),
    await leer(llamar('GET', '/envios/metodos')),
  );
  await llamar('POST', '/checkout/sesion', {
    token: accessToken,
    cuerpo: { idDireccion, idMetodoEnvio: metodos[0]?.idMetodoEnvio },
  });
  const pago = await llamar('POST', '/checkout/sesion/pagos', {
    token: accessToken,
    encabezados: { 'Idempotency-Key': randomUUID() },
    cuerpo: {
      numeroTarjeta: TARJETA_APROBADA,
      mesVencimiento: 12,
      anioVencimiento: 2030,
      cvv: CVV,
    },
  });
  expect(pago.status).toBe(201);
  requestIdDelPago = pago.headers.get('x-request-id') ?? '';

  secretos.push(
    CONTRASENA,
    accessToken,
    cookie.slice('refresh='.length),
    TARJETA_APROBADA,
    config.redis.contrasena,
  );
  // Los lotes de trazas y logs salen cada pocos segundos.
  await esperar(
    () => receptor.spans.some((s) => s.nombre === 'POST /api/v1/checkout/sesion/pagos'),
    ESPERA_EXPORTACION_MS,
  );
});

afterAll(async () => {
  await api.detener();
  await receptor.cerrar();
});

const delPago = (): SpanRecibido[] => {
  const raiz = receptor.spans.find((s) => s.nombre === 'POST /api/v1/checkout/sesion/pagos');
  return receptor.spans.filter((s) => s.traceId === raiz?.traceId);
};

describe('seguridad de la telemetría (E9-H01): lo que exporta la API instrumentada, en un receptor en memoria', () => {
  it('ningún span ni log lleva contraseñas, tokens, la contraseña de Redis, la tarjeta, el CVV ni encabezados', () => {
    const exportado = receptor.crudo();

    for (const secreto of secretos.filter((s) => s.length > 0)) {
      expect(exportado).not.toContain(secreto);
    }
    expect(exportado).not.toMatch(/cvv|authorization|cookie|Bearer /i);
    // Tres dígitos sueltos aparecen en cualquier duración o puerto: se busca el CVV como valor de texto.
    expect(exportado).not.toContain(`"${CVV}"`);
  });

  it('la traza del pago va de la petición a sus SPs y a la pasarela, y todos sus spans llevan su requestId', () => {
    const nombres = delPago().map((s) => s.nombre);
    const procedimientos = delPago().map((s) => s.atributos['db.stored_procedure.name']);

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
    expect(new Set(delPago().map((s) => s.atributos['shopcart.request_id']))).toEqual(
      new Set([requestIdDelPago]),
    );
  });

  it('los spans de SQL solo llevan el nombre del SP, nunca los valores de sus parámetros', () => {
    const sql = receptor.spans.filter(
      (s) => s.atributos['db.system.name'] === 'microsoft.sql_server',
    );
    const procedimientos = sql.filter((s) => s.atributos['db.stored_procedure.name'] !== undefined);

    expect(procedimientos.length).toBeGreaterThan(5);
    for (const span of procedimientos) {
      expect(span.atributos['db.query.text']).toMatch(/^SP_\w+$/);
      expect(span.atributos['db.query.text']).toBe(span.atributos['db.stored_procedure.name']);
    }
    // El correo viaja como parámetro de SP_Auth_ObtenerCredenciales.
    expect(JSON.stringify(sql)).not.toContain(correo);
  });

  it('los spans de Redis solo llevan el comando, sin sus argumentos', () => {
    const comandos = receptor.spans.filter((s) => s.atributos['db.system.name'] === 'redis');

    expect(comandos.length).toBeGreaterThan(0);
    for (const span of comandos) {
      expect(span.atributos['db.query.text']).toBe(span.atributos['db.operation.name']);
    }
  });

  it('los logs de la petición de pago llevan el trace_id de su traza', () => {
    const traza = delPago()[0]?.traceId;

    expect(receptor.logs.some((log) => log.traceId === traza)).toBe(true);
  });
});
