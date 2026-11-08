import { crearAdministrador, expect, iniciarSesionPorApi, test } from './fixtures';

test.describe('backoffice: revisión manual (M8-H05)', () => {
  test('el Administrador ve los reembolsos filtrados por estado y los pagos en revisión', async ({
    page,
    apiAdmin,
  }) => {
    await iniciarSesionPorApi(page, await crearAdministrador(apiAdmin));

    await page.goto('/backoffice/reembolsos');
    await expect(page.getByRole('heading', { name: 'Reembolsos', level: 1 })).toBeVisible();
    await page.getByLabel('Estado').selectOption('Completado');
    await expect(page).toHaveURL(/estado=Completado/);
    const tabla = page.getByRole('table', { name: 'Reembolsos' });
    const vacio = page.getByText('Ningún resultado con estos filtros');
    await expect(tabla.or(vacio).first()).toBeVisible();
    if (await tabla.isVisible()) {
      await expect(tabla.getByRole('row').nth(1)).toContainText('Completado');
      await expect(tabla.getByRole('button', { name: /^Reintentar/ })).toHaveCount(0);
    }

    await page.getByRole('link', { name: 'Pagos en revisión' }).click();
    await expect(page.getByRole('heading', { name: 'Pagos en revisión', level: 1 })).toBeVisible();
    await expect(
      page
        .getByRole('table', { name: 'Pagos en revisión' })
        .or(page.getByText('No hay pagos en revisión'))
        .first(),
    ).toBeVisible();
  });
});
