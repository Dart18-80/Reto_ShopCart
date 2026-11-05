import { crearOperador, expect, iniciarSesionPorApi, test } from './fixtures';

test.describe('cuenta: perfil y contraseña (M1-H02)', () => {
  test('guardar el perfil muestra el nombre nuevo sin recargar y lo conserva al volver', async ({
    page,
    apiAdmin,
  }) => {
    await iniciarSesionPorApi(page, await crearOperador(apiAdmin));
    await page.goto('/cuenta/perfil');

    const nombre = page.getByLabel('Nombre');
    await nombre.fill('Operador E2E renombrado');
    await page.getByRole('button', { name: 'Guardar datos' }).click();
    await expect(page.getByText('Tus datos se guardaron.')).toBeVisible();
    await expect(
      page.getByRole('complementary', { name: 'Tu cuenta' }).getByText('Operador E2E renombrado'),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Nombre')).toHaveValue('Operador E2E renombrado');
  });

  test('después de cambiar la contraseña la sesión sigue activa y un refresh posterior funciona (A-07)', async ({
    page,
    apiAdmin,
  }) => {
    const operador = await crearOperador(apiAdmin);
    await iniciarSesionPorApi(page, operador);
    await page.goto('/cuenta/perfil');

    await page.getByLabel('Contraseña actual').fill(operador.contrasena);
    await page.getByLabel('Contraseña nueva').fill('NuevaClave2027');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(page.getByText(/Contraseña actualizada/)).toBeVisible();

    // Recargar rehidrata con la cookie de refresh que llegó con la sesión nueva: la anterior quedó revocada.
    const refresh = page.waitForResponse('**/api/v1/auth/refresh');
    await page.reload();
    expect((await refresh).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Mi perfil' })).toBeVisible();
    await expect(page.getByLabel('Nombre')).toHaveValue('Operador E2E');

    const conLaAnterior = await page.request.post('/api/v1/auth/login', {
      data: { correo: operador.correo, contrasena: operador.contrasena },
    });
    expect(conLaAnterior.status()).toBe(401);
  });

  test('una contraseña actual incorrecta marca su campo', async ({ page, apiAdmin }) => {
    await iniciarSesionPorApi(page, await crearOperador(apiAdmin));
    await page.goto('/cuenta/perfil');

    await page.getByLabel('Contraseña actual').fill('NoEsLaMia2026');
    await page.getByLabel('Contraseña nueva').fill('NuevaClave2027');
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

    await expect(page.getByLabel('Contraseña actual')).toHaveAccessibleDescription(
      'La contraseña actual no es correcta.',
    );
  });
});
