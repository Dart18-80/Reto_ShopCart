import type { Page } from '@playwright/test';
import {
  agregarAlCarrito,
  comprarCarrito,
  direccionDe,
  pruebaDeCompra,
  varianteDe,
} from './compras';
import {
  crearAdministrador,
  expect,
  iniciarSesionPorApi,
  nombreUnico,
  otroClienteDeLaCorrida,
} from './fixtures';

// El login admite 5 por minuto por correo y el comprador ya entra en cada prueba del checkout: este archivo
// abre una sola sesión en el navegador y sus pruebas la comparten, una a la vez.
pruebaDeCompra.describe.configure({ mode: 'serial' });

let pagina: Page;

pruebaDeCompra.beforeAll(async ({ browser }, informacion) => {
  pagina = await browser.newPage({ baseURL: informacion.project.use.baseURL });
  await iniciarSesionPorApi(pagina, otroClienteDeLaCorrida());
});

pruebaDeCompra.afterAll(async () => {
  await pagina.close();
});

pruebaDeCompra.describe('mis pedidos (M5)', () => {
  pruebaDeCompra(
    'aislamiento (RF-01): el pedido de otro cliente se ve como «No encontrado», igual que uno inexistente',
    async ({ crearEnTienda, comprador, competidor }) => {
      const idProducto = await crearEnTienda(`Gorra ${nombreUnico('ajeno')}`, [
        { valores: [], precio: '90.00', existencia: 5 },
      ]);
      await agregarAlCarrito(competidor.api, await varianteDe(competidor.api, idProducto));
      await direccionDe(competidor.api);
      const pedidoAjeno = await comprarCarrito(competidor.api);
      await agregarAlCarrito(comprador.api, await varianteDe(comprador.api, idProducto));
      await direccionDe(comprador.api);
      const pedidoPropio = await comprarCarrito(comprador.api);

      await pagina.goto(`/pedidos/${String(pedidoPropio)}`);
      await expect(pagina.getByRole('heading', { name: /^Pedido SC-/ })).toBeVisible();

      await pagina.goto(`/pedidos/${String(pedidoAjeno)}`);
      await expect(
        pagina.getByRole('heading', { name: 'No encontramos este pedido' }),
      ).toBeVisible();

      await pagina.goto('/pedidos/2147483647');
      await expect(
        pagina.getByRole('heading', { name: 'No encontramos este pedido' }),
      ).toBeVisible();

      await pagina.goto('/pedidos');
      await expect(
        pagina.getByRole('link', {
          name: `Ver detalle de SC-${String(pedidoPropio).padStart(6, '0')}`,
        }),
      ).toBeVisible();
    },
  );

  pruebaDeCompra(
    'un pedido pagado se cancela con su motivo y queda Cancelado con su historial (M5-H02)',
    async ({ crearEnTienda, comprador }) => {
      const idProducto = await crearEnTienda(`Gorra ${nombreUnico('cancelar')}`, [
        { valores: [], precio: '120.00', existencia: 5 },
      ]);
      await agregarAlCarrito(comprador.api, await varianteDe(comprador.api, idProducto));
      await direccionDe(comprador.api);
      const idPedido = await comprarCarrito(comprador.api);

      await pagina.goto(`/pedidos/${String(idPedido)}`);
      await pagina.getByRole('button', { name: 'Cancelar pedido' }).click();
      const dialogo = pagina.getByRole('dialog', { name: 'Cancelar el pedido' });
      await dialogo.getByLabel('Motivo').fill('Me equivoqué de talla');
      await dialogo.getByRole('button', { name: 'Cancelar pedido' }).click();

      await expect(pagina.getByText(/^Cancelamos tu pedido\./)).toBeVisible();
      await expect(pagina.getByRole('heading', { level: 1 }).locator('..')).toContainText(
        'Cancelado',
      );
      const seguimiento = pagina.getByRole('region', { name: 'Seguimiento' });
      await expect(seguimiento).toContainText('Cancelado');
      await expect(seguimiento).toContainText('Me equivoqué de talla');
      await expect(pagina.getByRole('button', { name: 'Cancelar pedido' })).toBeHidden();
    },
  );

  pruebaDeCompra(
    'cambiar el precio de una variante: la tienda muestra el nuevo y un pedido anterior conserva el suyo (M6-H05, RF-02)',
    async ({ browser, apiAdmin, crearEnTienda, comprador }, informacion) => {
      const idProducto = await crearEnTienda(`Gorra ${nombreUnico('precio')}`, [
        { valores: [], precio: '100.00', existencia: 5 },
      ]);
      await agregarAlCarrito(comprador.api, await varianteDe(comprador.api, idProducto));
      await direccionDe(comprador.api);
      const idPedido = await comprarCarrito(comprador.api);
      const { datos } = (await (
        await apiAdmin.get(`/api/v1/admin/productos/${String(idProducto)}`)
      ).json()) as { datos: { variantes: { sku: string }[] } };
      const sku = datos.variantes[0]?.sku ?? '';

      const contexto = await browser.newContext({ baseURL: informacion.project.use.baseURL });
      const admin = await contexto.newPage();
      try {
        await iniciarSesionPorApi(admin, await crearAdministrador(apiAdmin));
        await admin.goto(`/backoffice/catalogo/productos/${String(idProducto)}`);
        await admin.getByRole('button', { name: `Cambiar precio de ${sku}` }).click();
        const dialogo = admin.getByRole('dialog', { name: `Cambiar precio de ${sku}` });
        await dialogo.getByLabel('Precio nuevo').fill('150.00');
        await dialogo.getByRole('button', { name: 'Guardar precio' }).click();
        const historial = dialogo.getByRole('list', { name: 'Historial de precios' });
        await expect(historial.getByRole('listitem').first()).toContainText('Vigente desde');
        await expect(historial.getByRole('listitem').first()).toContainText('Q150.00');
        await expect(historial.getByRole('listitem').nth(1)).toContainText('Q100.00');
      } finally {
        await contexto.close();
      }

      await pagina.goto(`/productos/${String(idProducto)}`);
      await expect(pagina.getByText('Q150.00').first()).toBeVisible();
      await pagina.goto(`/pedidos/${String(idPedido)}`);
      const articulos = pagina.getByRole('region', { name: 'Artículos' });
      await expect(articulos.getByRole('listitem').first()).toContainText('Q100.00');
    },
  );
});
