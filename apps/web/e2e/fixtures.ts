import { randomUUID } from 'node:crypto';
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';
import {
  VARIABLE_CLIENTE,
  VARIABLE_OTRO_CLIENTE,
  VARIABLE_TOKEN_ADMIN,
} from './preparacion-global';

export interface Credenciales {
  correo: string;
  contrasena: string;
}

/** Un Cliente que registró la preparación global, con el access token de su registro. */
export interface ClienteRegistrado extends Credenciales {
  accessToken: string;
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

function clienteRegistrado(variable: string): ClienteRegistrado {
  const guardado = process.env[variable];
  if (!guardado)
    throw new Error('Falta el cliente de la corrida: lo registra e2e/preparacion-global.ts.');
  return JSON.parse(guardado) as ClienteRegistrado;
}

/** El Cliente que registró la preparación global, por el límite de registros (A-07). */
export const clienteDeLaCorrida = (): ClienteRegistrado => clienteRegistrado(VARIABLE_CLIENTE);

/** El segundo Cliente de la corrida: el que paga en las pruebas del checkout. */
export const otroClienteDeLaCorrida = (): ClienteRegistrado =>
  clienteRegistrado(VARIABLE_OTRO_CLIENTE);

/**
 * Un usuario interno nuevo, creado por el Administrador: para las pruebas que cambian la contraseña o los datos de
 * su cuenta sin afectar a las demás, y sin gastar el límite de registros públicos (A-07).
 */
async function crearInterno(
  apiAdmin: APIRequestContext,
  rol: 'Operador' | 'Administrador',
): Promise<Credenciales> {
  const credenciales = {
    correo: `${nombreUnico(rol.toLowerCase())}@prueba.gt`,
    contrasena: `${rol}2026!`,
  };
  const respuesta = await apiAdmin.post('/api/v1/usuarios', {
    data: { ...credenciales, nombre: `${rol} E2E`, rol },
  });
  expect(respuesta.status(), `alta del ${rol}`).toBe(201);
  return credenciales;
}

export const crearOperador = (apiAdmin: APIRequestContext) => crearInterno(apiAdmin, 'Operador');

/**
 * Un Administrador nuevo para las pruebas del backoffice que entran por la pantalla: cada uno tiene su propio
 * límite de login (5 por minuto por correo), así no gastan el de la cuenta de la semilla.
 */
export const crearAdministrador = (apiAdmin: APIRequestContext) =>
  crearInterno(apiAdmin, 'Administrador');

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
