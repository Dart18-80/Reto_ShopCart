import { expect, nombreUnico, test } from './fixtures';
import { prueba, valorDeLaSemilla } from './tienda';

test.describe('catálogo de la tienda (M2-H02)', () => {
  prueba(
    'buscar «camion» desde el encabezado encuentra «Camión» (A-10, de punta a punta)',
    async ({ page, crearEnTienda }) => {
      const marca = nombreUnico('juguete');
      await crearEnTienda(`Camión ${marca}`);
      await page.goto('/');

      await page.getByRole('searchbox', { name: 'Buscar productos' }).fill(`camion ${marca}`);
      await page.keyboard.press('Enter');

      await expect(page.getByRole('link', { name: new RegExp(`Camión ${marca}`) })).toBeVisible();
      await expect(page).toHaveURL(/texto=camion/);
    },
  );

  prueba(
    'un producto creado por la API con una variante Azul aparece con la prenda azul y su precio',
    async ({ page, apiAdmin, crearEnTienda }) => {
      const nombre = `Camisa ${nombreUnico('azul')}`;
      const azul = await valorDeLaSemilla(apiAdmin, 'Color', 'Azul');
      await crearEnTienda(nombre, [{ valores: [azul], precio: '249.90' }]);

      await page.goto(`/?texto=${encodeURIComponent(nombre)}`);

      const tarjeta = page.getByRole('link', { name: new RegExp(nombre) });
      await expect(tarjeta.getByRole('img', { name: 'Camisa color Azul' })).toBeVisible();
      await expect(tarjeta.getByText('Q249.90')).toBeVisible();
      await expect(tarjeta.getByText('Agotado')).toBeVisible();
    },
  );

  test('filtrar y ordenar cambia la URL, recargar conserva la vista y «atrás» vuelve a la anterior', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Ordenar' }).selectOption('Precio: de mayor a menor');
    await expect(page).toHaveURL(/orden=precio&direccion=desc/);

    // La casilla refleja la URL: se marca cuando la URL ya cambió (por eso click y no check).
    await page.getByRole('checkbox', { name: 'Solo con existencia' }).click();
    await expect(page).toHaveURL(/disponible=true/);
    await expect(page.getByRole('checkbox', { name: 'Solo con existencia' })).toBeChecked();

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Ordenar' })).toHaveValue('precio-desc');
    await expect(page.getByRole('checkbox', { name: 'Solo con existencia' })).toBeChecked();

    await page.goBack();
    await expect(page).not.toHaveURL(/disponible=true/);
    await expect(page.getByRole('checkbox', { name: 'Solo con existencia' })).not.toBeChecked();
  });
});

test.describe('detalle de producto (M2-H03)', () => {
  prueba(
    'elegir color y talla muestra el precio de esa variante y la guarda en la URL',
    async ({ page, apiAdmin, crearEnTienda }) => {
      const [azul, negro, m, l] = await Promise.all([
        valorDeLaSemilla(apiAdmin, 'Color', 'Azul'),
        valorDeLaSemilla(apiAdmin, 'Color', 'Negro'),
        valorDeLaSemilla(apiAdmin, 'Talla', 'M'),
        valorDeLaSemilla(apiAdmin, 'Talla', 'L'),
      ]);
      const idProducto = await crearEnTienda(`Camisa ${nombreUnico('detalle')}`, [
        { valores: [m, azul], precio: '249.90', existencia: 10 },
        { valores: [l, azul], precio: '279.90', existencia: 10 },
        { valores: [m, negro], precio: '259.90', existencia: 10 },
      ]);

      await page.goto(`/productos/${String(idProducto)}`);
      await expect(page.getByRole('button', { name: 'Elige talla y color' })).toBeDisabled();
      await page.getByRole('button', { name: 'Azul' }).click();
      await page.getByRole('group', { name: 'Talla' }).getByRole('button', { name: 'L' }).click();

      await expect(page.getByText('Q279.90')).toBeVisible();
      await expect(page.getByRole('img', { name: 'Camisa color Azul' }).first()).toBeVisible();
      await expect(page).toHaveURL(/variante=\d+/);

      await page.reload();
      await expect(page.getByText('Q279.90')).toBeVisible();
    },
  );
});
