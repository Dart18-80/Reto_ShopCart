import { readFile } from 'node:fs/promises';
import { crearAdministrador, expect, iniciarSesionPorApi, test } from './fixtures';

// El procesador de exportaciones corre en segundo plano en la API: el archivo puede tardar unos segundos.
const ESPERA_DEL_ARCHIVO_MS = 30_000;

test.describe('backoffice: exportaciones (M11-H03)', () => {
  test('exportar las ventas en Excel, esperar a que quede Completada y descargar el archivo', async ({
    page,
    apiAdmin,
  }) => {
    await iniciarSesionPorApi(page, await crearAdministrador(apiAdmin));
    await page.goto('/backoffice/dashboard?agrupacion=semana');

    await page.getByRole('button', { name: 'Exportar Ventas por periodo' }).click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo.getByLabel('Formato')).toHaveValue('xlsx');
    await dialogo.getByRole('button', { name: 'Exportar' }).click();
    await expect(dialogo.getByText('Lista para descargar')).toBeVisible({
      timeout: ESPERA_DEL_ARCHIVO_MS,
    });

    const descarga = page.waitForEvent('download');
    await dialogo.getByRole('button', { name: 'Descargar' }).click();
    const archivo = await descarga;

    expect(archivo.suggestedFilename()).toMatch(/\.xlsx$/);
    const contenido = await readFile(await archivo.path());
    // Un .xlsx es un ZIP: empieza con «PK».
    expect(contenido.subarray(0, 2).toString('latin1')).toBe('PK');

    await dialogo.getByRole('link', { name: 'Ver mis exportaciones' }).click();
    const fila = page.getByRole('row').filter({ hasText: 'Ventas por periodo' }).first();
    await expect(fila).toContainText('por semana');
    await expect(fila).toContainText('Excel');
    await expect(fila).toContainText('Lista para descargar');
  });
});
