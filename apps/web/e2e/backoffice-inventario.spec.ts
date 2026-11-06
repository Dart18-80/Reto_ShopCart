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
      await expect(fila.getByRole('cell').nth(4)).toHaveText('0');
      await expect(page).toHaveURL(/texto=CAMISON/);
    },
  );

  prueba(
    'después de una entrada, el kardex muestra el movimiento con la existencia anterior y la resultante, y la conciliación sigue en verde',
    async ({ page, apiAdmin, crearEnTienda }) => {
      const marca = nombreUnico('entrada');
      await crearEnTienda(`Camisa ${marca}`, [{ valores: [], precio: '199.00', existencia: 5 }]);
      await iniciarSesionPorApi(page, await crearOperador(apiAdmin));
      await page.goto(`/backoffice/inventario?texto=${encodeURIComponent(marca)}`);
      const fila = page.getByRole('table', { name: 'Existencias' }).getByRole('row').nth(1);
      const sku = (await fila.getByRole('cell').first().innerText()).trim();

      await page.getByRole('button', { name: 'Registrar entrada' }).click();
      const entrada = page.getByRole('dialog', { name: 'Registrar entrada' });
      await entrada.getByLabel('Buscar variante').fill(marca);
      await expect(entrada.getByRole('option', { name: new RegExp(sku) })).toBeAttached();
      await entrada.getByRole('combobox', { name: 'Variante' }).selectOption({ index: 1 });
      await entrada.getByLabel('Cantidad').fill('7');
      await entrada.getByLabel('Motivo').fill('Compra de la prueba E2E');
      await entrada.getByLabel('Referencia').fill('F-E2E');
      await entrada.getByRole('button', { name: 'Registrar entrada' }).click();
      await expect(entrada).toBeHidden();

      await expect(fila.getByRole('cell').nth(2)).toHaveText('12');
      await page.getByRole('button', { name: `Ver kardex de ${sku}` }).click();
      const kardex = page.getByRole('dialog', { name: `Kardex de ${sku}` });
      const movimiento = kardex.getByRole('row').filter({ hasText: 'F-E2E' });
      await expect(movimiento).toContainText('Entrada por compra');
      await expect(movimiento).toContainText('+7');
      await expect(movimiento.getByRole('cell').nth(3)).toHaveText('5');
      await expect(movimiento.getByRole('cell').nth(4)).toHaveText('12');
      await kardex.getByRole('button', { name: 'Cerrar' }).click();
      await expect(page.getByText(COINCIDE)).toBeVisible();
    },
  );
});
