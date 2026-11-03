import { randomUUID } from 'node:crypto';
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

export interface Credenciales {
  correo: string;
  contrasena: string;
}

interface Sesion {
  datos: { accessToken: string };
}

// El Administrador es la única cuenta que no se puede crear por la API pública; sus credenciales se configuran.
const ADMINISTRADOR: Credenciales = {
  correo: process.env.SHOPCART_ADMIN_CORREO ?? 'admin@shopcart.gt',
  contrasena: process.env.SHOPCART_ADMIN_CONTRASENA ?? 'Admin2026!',
};

// Nombres únicos por corrida (`e2e-<corrida>-…`): las pruebas se repiten sin limpiar la base.
const CORRIDA = randomUUID().slice(0, 8);
let consecutivo = 0;

export function nombreUnico(prefijo: string): string {
  consecutivo += 1;
  return `e2e-${CORRIDA}-${prefijo}-${String(consecutivo)}`;
}

async function iniciarSesion(request: APIRequestContext, { correo, contrasena }: Credenciales) {
  const respuesta = await request.post('/api/v1/auth/login', { data: { correo, contrasena } });
  expect(respuesta.status(), `login de ${correo}`).toBe(200);
  return ((await respuesta.json()) as Sesion).datos.accessToken;
}

/**
 * Inicia sesión con el `request` de la página: la cookie `refresh` queda en el contexto del navegador y, al abrir
 * la tienda, la SPA rehidrata la sesión con ella (FE-05).
 */
export async function iniciarSesionPorApi(page: Page, credenciales: Credenciales) {
  await iniciarSesion(page.request, credenciales);
}

/** Registra un cliente nuevo por la API pública (A-07: el registro admite 3 por minuto por IP). */
async function registrarCliente(request: APIRequestContext): Promise<Credenciales> {
  const credenciales = {
    correo: `${nombreUnico('cliente')}@prueba.gt`,
    contrasena: 'Ensayo2026!',
  };
  const respuesta = await request.post('/api/v1/auth/registro', {
    data: { ...credenciales, nombre: 'Cliente de prueba E2E' },
  });
  expect(respuesta.status(), 'registro del cliente de prueba').toBe(201);
  return credenciales;
}

interface FixturesDePrueba {
  /** La API con el token de un Administrador, para preparar los datos de cada prueba. */
  apiAdmin: APIRequestContext;
}

interface FixturesDelWorker {
  /** Un Cliente registrado para esta corrida; las pruebas lo comparten por el límite de registros. */
  cliente: Credenciales;
}

export const test = base.extend<FixturesDePrueba, FixturesDelWorker>({
  cliente: [
    async ({ playwright }, usar, infoDelWorker) => {
      const request = await playwright.request.newContext({
        baseURL: infoDelWorker.project.use.baseURL,
      });
      await usar(await registrarCliente(request));
      await request.dispose();
    },
    { scope: 'worker' },
  ],
  apiAdmin: async ({ playwright, baseURL }, usar) => {
    const anonimo = await playwright.request.newContext({ baseURL });
    const token = await iniciarSesion(anonimo, ADMINISTRADOR);
    await anonimo.dispose();
    const apiAdmin = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await usar(apiAdmin);
    await apiAdmin.dispose();
  },
});

export { expect };
