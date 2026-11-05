import {
  agregarAlCarrito,
  comprarCarrito,
  direccionDe,
  pruebaDeCompra,
  varianteDe,
} from './compras';
import { expect, iniciarSesionPorApi, nombreUnico } from './fixtures';

// Las pruebas usan los carritos de los dos clientes de la corrida: una a la vez.
pruebaDeCompra.describe.configure({ mode: 'serial' });

pruebaDeCompra.describe('dirección y envío (M4-H02)', () => {
  pruebaDeCompra(
    'una variante con existencia 1 que otro cliente compra antes muestra el aviso de existencia insuficiente',
    async ({ page, crearEnTienda, comprador, competidor }) => {
      const nombre = `Gorra ${nombreUnico('ultima')}`;
      const idProducto = await crearEnTienda(nombre, [
        { valores: [], precio: '120.00', existencia: 1 },
      ]);
      const idVariante = await varianteDe(comprador.api, idProducto);
      await direccionDe(comprador.api);
      await agregarAlCarrito(comprador.api, idVariante);
      await agregarAlCarrito(competidor.api, idVariante);

      await iniciarSesionPorApi(page, comprador.credenciales);
      await page.goto('/checkout');
      const tuPedido = page.getByRole('region', { name: 'Tu pedido' });
      await expect(tuPedido).toContainText(`${nombre} × 1`);
      await expect(tuPedido).toContainText(/Al continuar apartamos tus productos por \d+ minutos/);

      await comprarCarrito(competidor.api);
      await page.getByRole('button', { name: 'Continuar al pago' }).click();

      const aviso = page.getByRole('alert');
      await expect(aviso).toContainText(`${nombre}: pediste 1, quedan 0.`);
      await aviso.getByRole('link', { name: 'Volver al carrito' }).click();
      await expect(page).toHaveURL(/\/carrito$/);
    },
  );
});
