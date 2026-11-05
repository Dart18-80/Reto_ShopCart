import { randomUUID } from 'node:crypto';
import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import {
  clienteDeLaCorrida,
  expect,
  otroClienteDeLaCorrida,
  type ClienteRegistrado,
} from './fixtures';
import { prueba } from './tienda';

/** Un Cliente de la corrida con su API (el access token de su registro): prepara y verifica sin gastar logins. */
export interface Comprador {
  credenciales: ClienteRegistrado;
  api: APIRequestContext;
}

interface Lista<T> {
  datos: T[];
}
interface Datos<T> {
  datos: T;
}

export const TARJETA_APROBADA = '4242424242424242';
export const TARJETA_RECHAZADA = '4000000000000002';
export const TARJETA_SIN_RESPUESTA = '4000000000000119';

/** Una tarjeta vigente: diciembre de dentro de dos años. */
export const VENCIMIENTO = { mes: 12, anio: new Date().getFullYear() + 2 };

async function leer<T>(respuesta: { json: () => Promise<unknown> }): Promise<T> {
  return (await respuesta.json()) as T;
}

/** Deja al Cliente sin pago en curso y con el carrito vacío: cada prueba del checkout empieza igual. */
async function dejarSinCompra(api: APIRequestContext) {
  // 404 si no tiene sesión Activa: está bien, no había nada que cancelar.
  await api.delete('/api/v1/checkout/sesion');
  const { datos } = await leer<Datos<{ lineas: { idLinea: number }[] }>>(
    await api.get('/api/v1/carrito'),
  );
  for (const { idLinea } of datos.lineas) {
    await api.delete(`/api/v1/carrito/lineas/${String(idLinea)}`);
  }
}

async function primerMunicipio(api: APIRequestContext): Promise<number> {
  const departamentos = await leer<Lista<{ idDepartamento: number }>>(
    await api.get('/api/v1/departamentos'),
  );
  const idDepartamento = departamentos.datos[0]?.idDepartamento ?? 0;
  const municipios = await leer<Lista<{ idMunicipio: number }>>(
    await api.get(`/api/v1/departamentos/${String(idDepartamento)}/municipios`),
  );
  const municipio = municipios.datos[0];
  if (!municipio) throw new Error('La base no tiene municipios');
  return municipio.idMunicipio;
}

/** La primera dirección del Cliente o una nueva (el máximo es 10, N-17: se reutiliza entre corridas). */
export async function direccionDe(api: APIRequestContext): Promise<number> {
  const { datos } = await leer<Lista<{ idDireccion: number }>>(
    await api.get('/api/v1/direcciones'),
  );
  const existente = datos[0];
  if (existente) return existente.idDireccion;
  const creada = await api.post('/api/v1/direcciones', {
    data: {
      nombreRecibe: 'Cliente E2E',
      telefonoRecibe: '55551234',
      idMunicipio: await primerMunicipio(api),
      direccionLinea: '5a avenida 10-20, zona 1',
      esPredeterminada: true,
    },
  });
  expect(creada.status(), 'alta de la dirección').toBe(201);
  return (await leer<Datos<{ idDireccion: number }>>(creada)).datos.idDireccion;
}

export async function varianteDe(api: APIRequestContext, idProducto: number): Promise<number> {
  const respuesta = await api.get(`/api/v1/productos/${String(idProducto)}`);
  const { datos } = await leer<Datos<{ variantes: { idVariante: number }[] }>>(respuesta);
  const variante = datos.variantes[0];
  if (!variante) throw new Error(`El producto ${String(idProducto)} no tiene variantes`);
  return variante.idVariante;
}

export async function agregarAlCarrito(api: APIRequestContext, idVariante: number, cantidad = 1) {
  const respuesta = await api.post('/api/v1/carrito/lineas', { data: { idVariante, cantidad } });
  expect(respuesta.status(), 'agregar al carrito').toBe(200);
}

/** Inicia el pago y paga con la tarjeta aprobada, como lo haría la pantalla (01 §6.1 y §6.2). */
export async function comprarCarrito(api: APIRequestContext) {
  const { datos } = await leer<Datos<{ metodos: { idMetodoEnvio: number }[] }>>(
    await api.get('/api/v1/envios/metodos'),
  );
  const sesion = await api.post('/api/v1/checkout/sesion', {
    data: { idDireccion: await direccionDe(api), idMetodoEnvio: datos.metodos[0]?.idMetodoEnvio },
  });
  expect(sesion.status(), 'iniciar el pago').toBe(201);
  const pago = await api.post('/api/v1/checkout/sesion/pagos', {
    headers: { 'idempotency-key': randomUUID() },
    data: {
      numeroTarjeta: TARJETA_APROBADA,
      mesVencimiento: VENCIMIENTO.mes,
      anioVencimiento: VENCIMIENTO.anio,
      cvv: '123',
    },
  });
  expect(pago.status(), 'pagar').toBe(201);
}

async function conSuApi(
  playwright: PlaywrightWorkerArgs['playwright'],
  baseURL: string | undefined,
  credenciales: ClienteRegistrado,
): Promise<Comprador> {
  const api = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${credenciales.accessToken}` },
  });
  await dejarSinCompra(api);
  return { credenciales, api };
}

async function cerrar({ api }: Comprador) {
  await dejarSinCompra(api);
  await api.dispose();
}

/**
 * Las pruebas del checkout: `comprador` es el que paga en la pantalla y `competidor` el otro cliente que compra
 * antes. Corren en su propio proyecto de Playwright, después de las demás, porque usan los carritos de los dos
 * clientes de la corrida; cada prueba los deja sin pago en curso y con el carrito vacío, al empezar y al terminar.
 */
export const pruebaDeCompra = prueba.extend<{ comprador: Comprador; competidor: Comprador }>({
  comprador: async ({ playwright, baseURL }, usar) => {
    const comprador = await conSuApi(playwright, baseURL, otroClienteDeLaCorrida());
    await usar(comprador);
    await cerrar(comprador);
  },
  competidor: async ({ playwright, baseURL }, usar) => {
    const competidor = await conSuApi(playwright, baseURL, clienteDeLaCorrida());
    await usar(competidor);
    await cerrar(competidor);
  },
});
