import { crearAdministrador, crearOperador, expect, iniciarSesionPorApi, test } from './fixtures';

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

test.describe('backoffice: usuarios (M10-H01)', () => {
  test('desactivar a un Operador hace que su sesión deje de funcionar de inmediato (A-07)', async ({
    page,
    browser,
    apiAdmin,
  }, informacion) => {
    const operador = await crearOperador(apiAdmin);
    await iniciarSesionPorApi(page, operador);
    await page.goto('/backoffice/inventario');
    await expect(page.getByRole('heading', { name: 'Inventario', level: 1 })).toBeVisible();

    const contexto = await browser.newContext({ baseURL: informacion.project.use.baseURL });
    const admin = await contexto.newPage();
    try {
      await iniciarSesionPorApi(admin, await crearAdministrador(apiAdmin));
      await admin.goto('/backoffice/usuarios?rol=Operador&activo=true');
      const fila = admin.getByRole('row').filter({ hasText: operador.correo });
      await fila.getByRole('button', { name: /^Desactivar a / }).click();
      // Se espera la respuesta del backend: mientras el diálogo modal se cierra, el resto de la página está
      // aria-hidden y la fila «desaparece» para el localizador antes de que la desactivación se confirme.
      const desactivado = admin.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().endsWith('/desactivar'),
      );
      await admin.getByRole('alertdialog').getByRole('button', { name: 'Desactivar' }).click();
      expect((await desactivado).status()).toBe(200);
      await expect(fila).toBeHidden();
    } finally {
      await contexto.close();
    }

    // La próxima petición del Operador responde 401 y su renovación también: la SPA lo lleva a ingresar.
    const siguiente = page.waitForResponse('**/api/v1/inventario/existencias?**');
    await page.getByLabel('Ordenar por').selectOption({ label: 'SKU' });
    expect((await siguiente).status()).toBe(401);
    await expect(page).toHaveURL(/\/ingresar/);
  });
});
