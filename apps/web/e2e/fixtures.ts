import { randomUUID } from 'node:crypto';
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import { VARIABLE_CLIENTE } from './preparacion-global';

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

/** El Cliente que registró la preparación global: uno por corrida, por el límite de registros (A-07). */
export function clienteDeLaCorrida(): Credenciales {
  const guardado = process.env[VARIABLE_CLIENTE];
  if (!guardado)
    throw new Error('Falta el cliente de la corrida: lo registra e2e/preparacion-global.ts.');
  return JSON.parse(guardado) as Credenciales;
}

interface FixturesDePrueba {
  /** La API con el token de un Administrador, para preparar los datos de cada prueba. */
  apiAdmin: APIRequestContext;
}

export const test = base.extend<FixturesDePrueba>({
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
