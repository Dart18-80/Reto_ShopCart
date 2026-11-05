import { clienteDeLaCorrida, expect, iniciarSesionPorApi, nombreUnico, test } from './fixtures';

test.describe('direcciones del Cliente (M4-H01)', () => {
  test('crear, editar y eliminar una dirección', async ({ page }) => {
    await iniciarSesionPorApi(page, clienteDeLaCorrida());
    await page.goto('/cuenta/direcciones');
    const alias = nombreUnico('casa').slice(-40);

    await page.getByRole('button', { name: 'Agregar dirección' }).click();
    const nueva = page.getByRole('dialog', { name: 'Nueva dirección' });
    await nueva.getByLabel('Alias (opcional)').fill(alias);
    await nueva.getByLabel('Quién recibe').fill('Ana Pérez');
    await nueva.getByLabel('Teléfono').fill('55551234');
    await nueva.getByLabel('Departamento').selectOption('Sacatepéquez');
    await nueva.getByRole('combobox', { name: 'Municipio' }).selectOption('Antigua Guatemala');
    await nueva.getByLabel('Dirección', { exact: true }).fill('Calle del Arco 5');
    await nueva.getByRole('button', { name: 'Guardar dirección' }).click();

    const tarjeta = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: alias }) });
    await expect(tarjeta).toContainText('Antigua Guatemala, Sacatepéquez');

    await tarjeta.getByRole('button', { name: `Editar ${alias}` }).click();
    const edicion = page.getByRole('dialog', { name: 'Editar dirección' });
    await edicion.getByLabel('Dirección', { exact: true }).fill('Calle del Arco 7');
    await edicion.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(tarjeta).toContainText('Calle del Arco 7');

    await tarjeta.getByRole('button', { name: `Eliminar ${alias}` }).click();
    await expect(page.getByRole('heading', { name: alias })).toBeHidden();
  });
});
