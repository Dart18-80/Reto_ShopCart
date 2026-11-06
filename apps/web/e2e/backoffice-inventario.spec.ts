import { crearOperador, expect, iniciarSesionPorApi, nombreUnico } from './fixtures';
import { prueba } from './tienda';

const COINCIDE = 'La existencia coincide con el kardex en todas las variantes.';

prueba.describe('backoffice: inventario (M7)', () => {
  prueba(
    'un Operador busca «camison» sin tilde y encuentra su variante agotada, con la conciliación en verde',
    async ({ page, apiAdmin, crearEnTienda }) => {
      const marca = nombreUnico('inventario');
      await crearEnTienda(`Camisón ${marca}`, [{ valores: [], precio: '199.00' }]);
      await iniciarSesionPorApi(page, await crearOperador(apiAdmin));

      await page.goto('/backoffice/inventario');
      await expect(page.getByText(COINCIDE)).toBeVisible();
      await page.getByLabel('Buscar').fill(`CAMISON ${marca}`);

      const tabla = page.getByRole('table', { name: 'Existencias' });
      const fila = tabla.getByRole('row').filter({ hasText: `Camisón ${marca}` });
      await expect(fila).toHaveCount(1);
      await expect(fila.getByRole('cell').last()).toHaveText('0');
      await expect(page).toHaveURL(/texto=CAMISON/);
    },
  );
});
