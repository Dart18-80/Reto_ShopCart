import type { Page } from '@playwright/test';
import {
  agregarAlCarrito,
  comprarCarrito,
  cuantosPedidos,
  direccionDe,
  pruebaDeCompra,
  TARJETA_APROBADA,
  TARJETA_RECHAZADA,
  TARJETA_SIN_RESPUESTA,
  VENCIMIENTO,
  varianteDe,
  type Comprador,
} from './compras';
import { expect, iniciarSesionPorApi, nombreUnico } from './fixtures';
import type { CrearEnTienda } from './tienda';

/** El comprador con un producto propio en el carrito y su dirección, ya en /checkout/pago. */
async function llegarAlPago(page: Page, crearEnTienda: CrearEnTienda, comprador: Comprador) {
  const idProducto = await crearEnTienda(`Gorra ${nombreUnico('pago')}`, [
    { valores: [], precio: '150.00', existencia: 5 },
  ]);
  await direccionDe(comprador.api);
  await agregarAlCarrito(comprador.api, await varianteDe(comprador.api, idProducto));
  await iniciarSesionPorApi(page, comprador.credenciales);
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Continuar al pago' }).click();
  await expect(page).toHaveURL(/\/checkout\/pago$/);
}

async function llenarTarjeta(page: Page, numero: string) {
  const datos = page.getByRole('form', { name: 'Datos de la tarjeta' });
  await datos.getByLabel('Número de tarjeta').fill(numero);
  await datos.getByLabel('Mes').selectOption(String(VENCIMIENTO.mes));
  await datos.getByLabel('Año').selectOption(String(VENCIMIENTO.anio));
  await datos.getByLabel('CVV').fill('123');
}

const botonPagar = (page: Page) => page.getByRole('button', { name: /^Pagar Q/ });
const URL_DEL_PEDIDO = /\/pedidos\/\d+\?nuevo=1$/;

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

pruebaDeCompra.describe('pago idempotente (M4-H03, RF-06)', () => {
  pruebaDeCompra(
    'doble clic en «Pagar» produce un solo pedido (verificado por la API)',
    async ({ page, crearEnTienda, comprador }) => {
      await llegarAlPago(page, crearEnTienda, comprador);
      const antes = await cuantosPedidos(comprador.api);

      await llenarTarjeta(page, TARJETA_APROBADA);
      await botonPagar(page).dblclick();

      await expect(page).toHaveURL(URL_DEL_PEDIDO);
      expect(await cuantosPedidos(comprador.api)).toBe(antes + 1);
    },
  );

  pruebaDeCompra(
    '4000 0000 0000 0002 muestra el rechazo; después 4242 4242 4242 4242 crea el pedido',
    async ({ page, crearEnTienda, comprador }) => {
      await llegarAlPago(page, crearEnTienda, comprador);
      const antes = await cuantosPedidos(comprador.api);

      await llenarTarjeta(page, TARJETA_RECHAZADA);
      await botonPagar(page).click();
      await expect(page.getByRole('alert')).toContainText('Fondos insuficientes.');
      await expect(page.getByLabel('Número de tarjeta')).toHaveValue('');

      await llenarTarjeta(page, TARJETA_APROBADA);
      await botonPagar(page).click();

      await expect(page).toHaveURL(URL_DEL_PEDIDO);
      expect(await cuantosPedidos(comprador.api)).toBe(antes + 1);
    },
  );

  pruebaDeCompra(
    '4000 0000 0000 0119 (tiempo agotado) muestra el aviso; «Reintentar» con la misma llave termina en un solo pedido',
    async ({ page, crearEnTienda, comprador }) => {
      await llegarAlPago(page, crearEnTienda, comprador);
      const antes = await cuantosPedidos(comprador.api);
      const llaves: (string | undefined)[] = [];
      page.on('request', (peticion) => {
        if (peticion.url().endsWith('/checkout/sesion/pagos'))
          llaves.push(peticion.headers()['idempotency-key']);
      });

      await llenarTarjeta(page, TARJETA_SIN_RESPUESTA);
      await botonPagar(page).click();
      await expect(page.getByText(/no se te cobrará dos veces/)).toBeVisible();

      await page.getByRole('button', { name: 'Reintentar' }).click();

      await expect(page).toHaveURL(URL_DEL_PEDIDO);
      expect(await cuantosPedidos(comprador.api)).toBe(antes + 1);
      expect(llaves).toHaveLength(2);
      expect(llaves[1]).toBe(llaves[0]);
    },
  );
});
