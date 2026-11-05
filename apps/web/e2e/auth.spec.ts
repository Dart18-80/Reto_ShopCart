import type { Page } from '@playwright/test';
import { expect, nombreUnico, test } from './fixtures';

const CONTRASENA = 'Ensayo2026!';

async function enviarIngreso(page: Page, correo: string, contrasena: string) {
  await page.getByLabel('Correo electrónico').fill(correo);
  await page.getByLabel('Contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.describe('cuenta: ingresar y registrarse (M1-H01)', () => {
  test('registrarse con un correo único inicia sesión; cerrar sesión e ingresar de nuevo funciona', async ({
    page,
  }) => {
    const correo = `${nombreUnico('registro')}@prueba.gt`;

    await page.goto('/registro');
    await page.getByLabel('Nombre').fill('Cliente de prueba E2E');
    await page.getByLabel('Correo electrónico').fill(correo);
    await page.getByLabel('Contraseña').fill(CONTRASENA);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('link', { name: 'Mi cuenta' })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/cuenta/perfil');
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.getByRole('heading', { name: 'Ingresa a tu cuenta' })).toBeVisible();

    await enviarIngreso(page, correo, CONTRASENA);
    // Ingresar desde /ingresar?volver=/cuenta/perfil regresa a esa ruta.
    await expect(page).toHaveURL(/\/cuenta\/perfil$/);
    await expect(page.getByRole('link', { name: 'Mi cuenta' })).toBeVisible();
  });

  test('credenciales incorrectas se avisan, y el sexto intento muestra el aviso de demasiados intentos', async ({
    page,
  }) => {
    // Un correo propio de la corrida: el límite (5 por minuto por IP y correo, A-07) no afecta a otras pruebas.
    const correo = `${nombreUnico('intentos')}@prueba.gt`;
    await page.goto('/ingresar');

    await enviarIngreso(page, correo, 'incorrecta1');
    await expect(page.getByRole('alert')).toHaveText('Correo o contraseña incorrectos.');
    for (let intento = 2; intento <= 5; intento++) {
      await page.getByRole('button', { name: 'Ingresar' }).click();
      await expect(page.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
    }
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page.getByRole('alert')).toHaveText(
      'Demasiados intentos. Espera un momento e intenta de nuevo.',
    );
  });
});
