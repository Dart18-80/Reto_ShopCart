import { crearAdministrador, expect, iniciarSesionPorApi, nombreUnico } from './fixtures';
import { prueba } from './tienda';

prueba.describe('backoffice: bitácora (M10-H02)', () => {
  prueba(
    'después de cambiar un precio, la bitácora muestra el cambio con el valor anterior y el nuevo',
    async ({ page, apiAdmin, crearEnTienda }) => {
      // Precios al azar por corrida: la base guarda la bitácora de las corridas anteriores (es un ledger, M-01).
      const entero = 1000 + Math.floor(Math.random() * 8000);
      const antes = `${String(entero)}.45`;
      const despues = `${String(entero + 1)}.45`;
      const idProducto = await crearEnTienda(`Gorra ${nombreUnico('bitacora')}`, [
        { valores: [], precio: antes, existencia: 2 },
      ]);
      const { datos } = (await (
        await apiAdmin.get(`/api/v1/admin/productos/${String(idProducto)}`)
      ).json()) as { datos: { variantes: { sku: string }[] } };
      const sku = datos.variantes[0]?.sku ?? '';
      await iniciarSesionPorApi(page, await crearAdministrador(apiAdmin));

      await page.goto(`/backoffice/catalogo/productos/${String(idProducto)}`);
      await page.getByRole('button', { name: `Cambiar precio de ${sku}` }).click();
      const dialogo = page.getByRole('dialog', { name: `Cambiar precio de ${sku}` });
      await dialogo.getByLabel('Precio nuevo').fill(despues);
      await dialogo.getByRole('button', { name: 'Guardar precio' }).click();
      // El historial ya tiene la versión nueva: el backend confirmó el cambio.
      await expect(
        dialogo.getByRole('list', { name: 'Historial de precios' }).getByRole('listitem'),
      ).toHaveCount(2);
      await page.keyboard.press('Escape');

      await page.goto('/backoffice/bitacora?modulo=Catalogo&entidad=PrecioVariante');
      const fila = page
        .getByRole('row')
        .filter({ has: page.locator('details', { hasText: `${antes} → ${despues}` }) });
      await expect(fila).toHaveCount(1);
      await expect(fila).toContainText('Modificar');
      await expect(fila).toContainText('Administrador E2E');
      await fila.getByText(/cambios?$/).click();
      await expect(fila.getByText(`${antes} → ${despues}`)).toBeVisible();
    },
  );
});
