import { randomUUID } from 'node:crypto';
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import { VARIABLE_CLIENTE, VARIABLE_TOKEN_ADMIN } from './preparacion-global';

export interface Credenciales {
  correo: string;
  contrasena: string;
}

interface Sesion {
  datos: { accessToken: string };
}

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

/**
 * Un Operador nuevo, creado por el Administrador: para las pruebas que cambian la contraseña o los datos de su
 * cuenta sin afectar a las demás, y sin gastar el límite de registros públicos (A-07).
 */
export async function crearOperador(apiAdmin: APIRequestContext): Promise<Credenciales> {
  const credenciales = {
    correo: `${nombreUnico('operador')}@prueba.gt`,
    contrasena: 'Operador2026!',
  };
  const respuesta = await apiAdmin.post('/api/v1/usuarios', {
    data: { ...credenciales, nombre: 'Operador E2E', rol: 'Operador' },
  });
  expect(respuesta.status(), 'alta del Operador').toBe(201);
  return credenciales;
}

interface FixturesDePrueba {
  /** La API con el token de un Administrador, para preparar los datos de cada prueba. */
  apiAdmin: APIRequestContext;
}

export const test = base.extend<FixturesDePrueba>({
  apiAdmin: async ({ playwright, baseURL }, usar) => {
    // La sesión del Administrador la abrió la preparación global, una sola vez por corrida.
    const token = process.env[VARIABLE_TOKEN_ADMIN];
    if (!token)
      throw new Error('Falta la sesión del Administrador: la abre e2e/preparacion-global.ts.');
    const apiAdmin = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });
    await usar(apiAdmin);
    await apiAdmin.dispose();
  },
});

export { expect };
