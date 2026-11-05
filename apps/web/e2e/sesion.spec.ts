import type { BrowserContext, Page } from '@playwright/test';
import { expect, iniciarSesionPorApi, test } from './fixtures';

// Con sesión, el encabezado de la tienda cambia «Ingresar» por «Mi cuenta» (Figma: Encabezado tienda).
async function esperarSesion(page: Page) {
  await expect(page.getByRole('link', { name: 'Mi cuenta' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ingresar' })).toHaveCount(0);
}

const DEMORA_DEL_REFRESH_MS = 300;

/** Cuenta cuántos `POST /auth/refresh` del contexto están en vuelo a la vez (todas sus pestañas). */
async function contarRefreshEnVuelo(context: BrowserContext) {
  const medicion = { enVuelo: 0, maximoEnVuelo: 0 };
  await context.route('**/api/v1/auth/refresh', async (ruta) => {
    medicion.enVuelo += 1;
    medicion.maximoEnVuelo = Math.max(medicion.maximoEnVuelo, medicion.enVuelo);
    await new Promise((resolver) => setTimeout(resolver, DEMORA_DEL_REFRESH_MS));
    const respuesta = await ruta.fetch();
    medicion.enVuelo -= 1;
    await ruta.fulfill({ response: respuesta });
  });
  return medicion;
}

test.describe('sesión (FE-05)', () => {
  test('recargar la página conserva la sesión (rehidratación)', async ({ page, cliente }) => {
    await iniciarSesionPorApi(page, cliente);

    await page.goto('/');
    await esperarSesion(page);
    await page.reload();

    await esperarSesion(page);
  });

  test('dos pestañas que recargan a la vez no pierden la sesión, y una tercera recarga sigue con ella', async ({
    page,
    context,
    cliente,
  }) => {
    await iniciarSesionPorApi(page, cliente);
    const otra = await context.newPage();
    await Promise.all([page.goto('/'), otra.goto('/')]);
    await Promise.all([esperarSesion(page), esperarSesion(otra)]);

    // Las dos rehidratan con la misma cookie de refresh: sin el lock, la segunda sería un reúso y cerraría la
    // familia de tokens (REFRESH_REUTILIZADO, A-07). La demora agranda la ventana en que los dos refresh se
    // cruzarían; con Web Locks nunca hay dos en vuelo a la vez.
    const refresh = await contarRefreshEnVuelo(context);
    await Promise.all([page.reload(), otra.reload()]);
    await Promise.all([esperarSesion(page), esperarSesion(otra)]);
    expect(refresh.maximoEnVuelo).toBe(1);

    const tercera = await context.newPage();
    await tercera.goto('/');
    await esperarSesion(tercera);
    await tercera.reload();
    await esperarSesion(tercera);
  });
});

test.describe('control por rol (FE-04)', () => {
  test('un Cliente que entra por URL al backoffice ve «Sin permiso» (RF-01)', async ({
    page,
    cliente,
  }) => {
    await iniciarSesionPorApi(page, cliente);

    await page.goto('/backoffice/inventario');

    await expect(page.getByRole('heading', { name: 'Sin permiso' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Backoffice' })).toHaveCount(0);
  });
});
