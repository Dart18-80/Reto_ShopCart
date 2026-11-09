import { expect, test, type Page } from '@playwright/test';
import { clienteDeLaCorrida } from './fixtures';

// D4 (03-backlog, pase de diseño): pruebas solo del diseño. Ingresar cabe sin scroll en los tamaños de la revisión
// y ninguna pantalla de la tienda se desplaza a lo ancho en un teléfono de 360 px.

const TAMANOS_INGRESAR = [
  { width: 1366, height: 657 },
  { width: 1280, height: 720 },
  { width: 375, height: 667 },
  { width: 360, height: 640 },
] as const;

const TELEFONO_ANGOSTO = { width: 360, height: 640 } as const;

/** Lo que la página mide más allá de la ventana, en cada eje (0 si cabe). */
const desborde = (page: Page) =>
  page.evaluate(() => {
    const raiz = document.documentElement;
    return {
      alto: raiz.scrollHeight - raiz.clientHeight,
      ancho: raiz.scrollWidth - raiz.clientWidth,
    };
  });

async function ingresarComoCliente(page: Page) {
  const { correo, contrasena } = clienteDeLaCorrida();
  const ingresar = () => page.request.post('/api/v1/auth/login', { data: { correo, contrasena } });
  let respuesta = await ingresar();
  if (respuesta.status() === 429) {
    const segundos = Number(respuesta.headers()['retry-after'] ?? '60');
    await page.waitForTimeout(segundos * 1000);
    respuesta = await ingresar();
  }
  expect(respuesta.status()).toBe(200);
}

async function abrir(page: Page, ruta: string) {
  await page.goto(ruta);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test.describe('Ingresar sin scroll (D4)', () => {
  for (const tamano of TAMANOS_INGRESAR) {
    test(`en ${String(tamano.width)}×${String(tamano.height)}`, async ({ page }) => {
      await page.setViewportSize(tamano);

      await abrir(page, '/ingresar');

      expect((await desborde(page)).alto).toBeLessThanOrEqual(0);
    });
  }

  test('Registro deja el botón a la vista en 1366×657', async ({ page }) => {
    await page.setViewportSize(TAMANOS_INGRESAR[0]);

    await abrir(page, '/registro');

    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeInViewport();
  });
});

test.describe('la tienda sin scroll horizontal en 360 px (D4)', () => {
  test.use({ viewport: TELEFONO_ANGOSTO });

  for (const ruta of ['/', '/carrito', '/ingresar', '/registro']) {
    test(`invitado: ${ruta}`, async ({ page }) => {
      await abrir(page, ruta);

      expect((await desborde(page)).ancho).toBeLessThanOrEqual(0);
    });
  }

  test('invitado: el detalle de un producto', async ({ page }) => {
    await abrir(page, '/');
    await page
      .getByRole('link')
      .filter({ has: page.getByRole('heading', { level: 2 }) })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    expect((await desborde(page)).ancho).toBeLessThanOrEqual(0);
  });

  // Un solo ingreso para las tres pantallas. El login admite 5 intentos por minuto por correo (A-07) y este
  // proyecto corre justo después de los demás: si responde 429, se espera lo que dice Retry-After y se reintenta.
  test('Cliente: mis pedidos, su perfil y sus direcciones', async ({ page }) => {
    test.setTimeout(120_000);
    await ingresarComoCliente(page);

    for (const ruta of ['/pedidos', '/cuenta/perfil', '/cuenta/direcciones']) {
      await abrir(page, ruta);

      expect((await desborde(page)).ancho, ruta).toBeLessThanOrEqual(0);
    }
  });
});
