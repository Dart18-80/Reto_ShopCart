import { crearAdministrador, expect, iniciarSesionPorApi, nombreUnico, test } from './fixtures';
import { prueba } from './tienda';

interface Lista<T> {
  datos: T[];
}

test.describe('backoffice: categorías y atributos (M6-H02)', () => {
  test('crear una categoría con su ilustración y verla en los chips de la tienda', async ({
    page,
    apiAdmin,
  }) => {
    const nombre = nombreUnico('categoria');
    await iniciarSesionPorApi(page, await crearAdministrador(apiAdmin));
    try {
      await page.goto('/backoffice/catalogo/categorias');
      await page.getByRole('button', { name: 'Nueva categoría' }).click();
      const dialogo = page.getByRole('dialog', { name: 'Nueva categoría' });
      await dialogo.getByLabel('Nombre', { exact: true }).fill(nombre);
      await dialogo.getByRole('radio', { name: 'Gorra' }).click();
      await dialogo.getByRole('button', { name: 'Guardar categoría' }).click();
      await expect(dialogo).toBeHidden();
      const fila = page.getByRole('row').filter({ hasText: nombre });
      await expect(fila.getByRole('img', { name: 'Gorra' })).toBeVisible();
      await expect(fila).toContainText('Activa');

      await page.goto('/');
      await expect(page.getByRole('button', { name: nombre })).toBeVisible();
    } finally {
      // La tienda real no se queda con la categoría de la prueba (N-14: desactivar, no borrar).
      const { datos } = (await (await apiAdmin.get('/api/v1/admin/categorias')).json()) as Lista<{
        idCategoria: number;
        nombre: string;
      }>;
      const creada = datos.find((c) => c.nombre === nombre);
      if (creada) {
        await apiAdmin.post(`/api/v1/admin/categorias/${String(creada.idCategoria)}/desactivar`);
      }
    }
  });
});

prueba.describe('backoffice: editor de producto (M6-H04)', () => {
  prueba(
    'una variante nueva aparece en el detalle de la tienda con su color y su talla',
    async ({ page, apiAdmin, crearEnTienda }) => {
      const nombre = `Camisa ${nombreUnico('editor')}`;
      const idProducto = await crearEnTienda(nombre, []);
      await iniciarSesionPorApi(page, await crearAdministrador(apiAdmin));

      await page.goto(`/backoffice/catalogo/productos/${String(idProducto)}`);
      await page.getByRole('button', { name: 'Agregar variante' }).click();
      const dialogo = page.getByRole('dialog', { name: 'Agregar variante' });
      await dialogo.getByLabel('SKU').fill(nombreUnico('sku').slice(-40));
      await dialogo.getByLabel('Color').selectOption('Azul');
      await dialogo.getByLabel('Talla').selectOption('M');
      await dialogo.getByLabel('Precio inicial').fill('199.00');
      await dialogo.getByRole('button', { name: 'Guardar variante' }).click();
      await expect(dialogo).toBeHidden();
      await expect(page.getByRole('row').filter({ hasText: 'Q199.00' })).toBeVisible();

      await page.goto(`/productos/${String(idProducto)}`);
      await expect(page.getByRole('heading', { name: nombre })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Azul' })).toBeVisible();
      await expect(
        page.getByRole('group', { name: 'Talla' }).getByRole('button', { name: 'M' }),
      ).toBeVisible();
    },
  );
});
