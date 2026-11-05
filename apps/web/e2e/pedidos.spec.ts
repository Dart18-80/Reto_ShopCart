import type { Page } from '@playwright/test';
import {
  agregarAlCarrito,
  comprarCarrito,
  direccionDe,
  pruebaDeCompra,
  varianteDe,
} from './compras';
import { expect, iniciarSesionPorApi, nombreUnico, otroClienteDeLaCorrida } from './fixtures';

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
});
