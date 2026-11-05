import { expect, nombreUnico } from './fixtures';
import { prueba } from './tienda';

prueba.describe('carrito del invitado (M3-H02)', () => {
  prueba(
    'agregar desde el detalle, cambiar la cantidad, eliminar y ver el carrito vacío',
    async ({ page, crearEnTienda }) => {
      const nombre = `Gorra ${nombreUnico('carrito')}`;
      const idProducto = await crearEnTienda(nombre, [
        { valores: [], precio: '199.00', existencia: 5 },
      ]);

      await page.goto(`/productos/${String(idProducto)}`);
      await page.getByRole('button', { name: 'Agregar al carrito' }).click();
      await expect(page.getByText('Agregado al carrito')).toBeVisible();
      await page.getByRole('button', { name: 'Ver carrito' }).click();

      const lista = page.getByRole('list', { name: 'Productos del carrito' });
      await expect(lista.getByRole('heading', { name: nombre })).toBeVisible();
      await expect(lista.getByText('Q199.00').first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Carrito/ })).toContainText('1');

      await lista.getByRole('button', { name: 'Agregar uno' }).click();
      await expect(lista.getByText('Q398.00')).toBeVisible();
      await expect(page.getByRole('link', { name: /Carrito/ })).toContainText('2');

      await lista.getByRole('button', { name: `Eliminar ${nombre}` }).click();
      await expect(page.getByText('Tu carrito está vacío')).toBeVisible();
    },
  );
});
