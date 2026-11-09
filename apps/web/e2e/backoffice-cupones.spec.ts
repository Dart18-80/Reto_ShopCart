import { crearAdministrador, expect, iniciarSesionPorApi, nombreUnico } from './fixtures';
import { prueba } from './tienda';

prueba.describe('backoffice: cupones (M9-H01)', () => {
  prueba(
    'el Administrador crea un cupón de porcentaje para una categoría y se aplica en el carrito',
    async ({ page, browser, apiAdmin, crearEnTienda }, informacion) => {
      const marca = nombreUnico('cupon');
      const idProducto = await crearEnTienda(`Gorra ${marca}`, [
        { valores: [], precio: '100.00', existencia: 5 },
      ]);
      const { datos } = (await (
        await apiAdmin.get(`/api/v1/admin/productos/${String(idProducto)}`)
      ).json()) as { datos: { idCategoria: number } };
      const codigo = `E2E${String(Date.now()).slice(-9)}`;
      // Desde hoy (en Guatemala, UTC−6): el orden por omisión (vigencia, la más reciente primero) lo deja arriba.
      const HORAS_GUATEMALA = 6;
      const hoy = new Date(Date.now() - HORAS_GUATEMALA * 3_600_000).toISOString().slice(0, 10);
      const anio = Number(hoy.slice(0, 4));

      const contexto = await browser.newContext({ baseURL: informacion.project.use.baseURL });
      const admin = await contexto.newPage();
      try {
        await iniciarSesionPorApi(admin, await crearAdministrador(apiAdmin));
        await admin.goto('/backoffice/cupones');
        await admin.getByRole('button', { name: 'Nuevo cupón' }).click();
        const dialogo = admin.getByRole('dialog', { name: 'Nuevo cupón' });
        await dialogo.getByLabel('Código').fill(codigo);
        await dialogo.getByLabel('Descripción').fill(`10 % en ${marca}`);
        await dialogo.getByLabel('Valor').fill('10');
        await dialogo.getByLabel('Alcance').selectOption(String(datos.idCategoria));
        await dialogo.getByLabel('Vigente desde').fill(`${hoy}T00:00`);
        await dialogo.getByLabel('Vigente hasta').fill(`${String(anio + 1)}-12-31T23:59`);
        await dialogo.getByLabel('Límite de usos').fill('10');
        await dialogo.getByRole('button', { name: 'Crear cupón' }).click();
        await expect(dialogo).toBeHidden();

        const fila = admin.getByRole('row').filter({ hasText: codigo });
        await expect(fila).toContainText('10 %');
      } finally {
        await contexto.close();
      }

      await page.goto(`/productos/${String(idProducto)}`);
      await page.getByRole('button', { name: 'Agregar al carrito' }).click();
      await expect(page.getByText('Agregado al carrito')).toBeVisible();
      await page.goto('/carrito');
      await page.getByLabel('¿Tienes un cupón?').fill(codigo.toLowerCase());
      await page.getByRole('button', { name: 'Aplicar' }).click();

      await expect(page.getByText(`Cupón ${codigo} aplicado`)).toBeVisible();
      await expect(page.getByText(`Descuento (${codigo})`).locator('..')).toContainText('Q10.00');

      // Como crearEnTienda con lo suyo: el cupón de la prueba no queda activo en la tienda.
      const { datos: cupones } = (await (await apiAdmin.get('/api/v1/admin/cupones')).json()) as {
        datos: { idCupon: number; codigo: string }[];
      };
      const creado = cupones.find((c) => c.codigo === codigo);
      if (creado) await apiAdmin.post(`/api/v1/admin/cupones/${String(creado.idCupon)}/desactivar`);
    },
  );
});
