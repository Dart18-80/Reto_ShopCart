import { expect, test } from './fixtures';

// F1-H01: nginx sirve la SPA y balancea la API en un solo origen (A-03).
test.describe('nginx: un solo origen (A-03)', () => {
  for (const ruta of ['/catalogo/x', '/backoffice/inventario', '/cuenta/perfil?pestana=datos']) {
    test(`recargar ${ruta} devuelve la SPA, no un 404 de nginx`, async ({ page }) => {
      const respuesta = await page.goto(ruta);

      expect(respuesta?.status()).toBe(200);
      expect(respuesta?.headers()['content-type']).toContain('text/html');
      await expect(page.getByRole('link', { name: 'ShopCart' }).first()).toBeVisible();
    });
  }

  test('una ruta que la SPA no conoce muestra su propio «No encontrado»', async ({ page }) => {
    await page.goto('/catalogo/x');

    await expect(page.getByRole('heading', { name: 'No encontramos esta página' })).toBeVisible();
  });

  test('la API, Swagger y las imágenes estáticas siguen respondiendo', async ({ request }) => {
    const [salud, swagger, imagen] = await Promise.all([
      request.get('/api/v1/health'),
      request.get('/api/docs/'),
      request.get('/static/productos/calzado.svg'),
    ]);

    expect(salud.status()).toBe(200);
    expect(swagger.status()).toBe(200);
    expect(imagen.status()).toBe(200);
    expect(imagen.headers()['content-type']).toContain('image/svg+xml');
  });

  test('las peticiones a la API se reparten entre las dos réplicas', async ({ request }) => {
    const instancias = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const respuesta = await request.get('/api/v1/health');
      instancias.add(respuesta.headers()['x-instancia'] ?? '');
    }

    expect([...instancias].sort()).toEqual(['api-1', 'api-2']);
  });
});
