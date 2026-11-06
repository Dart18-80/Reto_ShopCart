import { crearAdministrador, expect, iniciarSesionPorApi, nombreUnico, test } from './fixtures';

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
