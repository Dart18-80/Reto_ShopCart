import { randomUUID } from 'node:crypto';
import { request, type FullConfig } from '@playwright/test';

export const VARIABLE_CLIENTE = 'SHOPCART_E2E_CLIENTE';

/**
 * Registra un solo Cliente por corrida, antes de todos los workers: el registro admite 3 por minuto por IP (A-07),
 * así la corrida no depende de cuántos workers haya. Las pruebas lo leen con clienteDeLaCorrida().
 */
export default async function prepararCorrida(configuracion: FullConfig) {
  const baseURL = configuracion.projects[0]?.use.baseURL;
  const api = await request.newContext({ baseURL });
  const credenciales = {
    correo: `e2e-${randomUUID().slice(0, 8)}-cliente@prueba.gt`,
    contrasena: 'Ensayo2026!',
  };
  const respuesta = await api.post('/api/v1/auth/registro', {
    data: { ...credenciales, nombre: 'Cliente de prueba E2E' },
  });
  await api.dispose();
  if (respuesta.status() !== 201) {
    throw new Error(
      `No se pudo registrar el cliente de la corrida (${String(respuesta.status())}): ${await respuesta.text()}`,
    );
  }
  // Las variables que fija la preparación global llegan a todos los workers.
  process.env[VARIABLE_CLIENTE] = JSON.stringify(credenciales);
}
