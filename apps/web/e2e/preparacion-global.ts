import { randomUUID } from 'node:crypto';
import { request, type APIRequestContext, type FullConfig } from '@playwright/test';

export const VARIABLE_CLIENTE = 'SHOPCART_E2E_CLIENTE';
export const VARIABLE_TOKEN_ADMIN = 'SHOPCART_E2E_TOKEN_ADMIN';

// El Administrador es la única cuenta que no se puede crear por la API pública; sus credenciales se configuran.
const ADMINISTRADOR = {
  correo: process.env.SHOPCART_ADMIN_CORREO ?? 'admin@shopcart.gt',
  contrasena: process.env.SHOPCART_ADMIN_CONTRASENA ?? 'Admin2026!',
};

/**
 * Antes de todos los workers: registra un solo Cliente (el registro admite 3 por minuto por IP) y abre una sola
 * sesión de Administrador (el login admite 5 por minuto por IP y correo, A-07). Así la corrida no depende de
 * cuántos workers o pruebas haya. Las pruebas los leen con clienteDeLaCorrida() y el fixture apiAdmin; el access
 * token dura 15 minutos, más que una corrida.
 */
export default async function prepararCorrida(configuracion: FullConfig) {
  const baseURL = configuracion.projects[0]?.use.baseURL;
  const api = await request.newContext({ baseURL });
  try {
    process.env[VARIABLE_CLIENTE] = JSON.stringify(await registrarCliente(api));
    process.env[VARIABLE_TOKEN_ADMIN] = await abrirSesionDeAdministrador(api);
  } finally {
    await api.dispose();
  }
}

async function registrarCliente(api: APIRequestContext) {
  const credenciales = {
    correo: `e2e-${randomUUID().slice(0, 8)}-cliente@prueba.gt`,
    contrasena: 'Ensayo2026!',
  };
  const respuesta = await api.post('/api/v1/auth/registro', {
    data: { ...credenciales, nombre: 'Cliente de prueba E2E' },
  });
  if (respuesta.status() !== 201) {
    throw new Error(
      `No se pudo registrar el cliente de la corrida (${String(respuesta.status())}): ${await respuesta.text()}`,
    );
  }
  return credenciales;
}

async function abrirSesionDeAdministrador(api: APIRequestContext): Promise<string> {
  const respuesta = await api.post('/api/v1/auth/login', { data: ADMINISTRADOR });
  if (respuesta.status() !== 200) {
    throw new Error(
      `No se pudo abrir la sesión del Administrador (${String(respuesta.status())}): ${await respuesta.text()}`,
    );
  }
  const { datos } = (await respuesta.json()) as { datos: { accessToken: string } };
  return datos.accessToken;
}
