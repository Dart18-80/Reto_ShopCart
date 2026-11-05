import { clienteDeLaCorrida, expect, nombreUnico } from './fixtures';
import { prueba } from './tienda';

prueba.describe('carrito del invitado (M3-H02)', () => {
  prueba(
    'agregar desde el detalle, cambiar la cantidad, eliminar y ver el carrito vacío',
    async ({ page, crearEnTienda }) => {
      const nombre = `Gorra ${nombreUnico('carrito')}`;
      const idProducto = await crearEnTienda(nombre, [
        { valores: [], precio: '199.00', existencia: 5 },
      ]);

      await page.goto(`/productos/${String(idProducto)}`);
      await page.getByRole('button', { name: 'Agregar al carrito' }).click();
      await expect(page.getByText('Agregado al carrito')).toBeVisible();
      await page.getByRole('button', { name: 'Ver carrito' }).click();

      const lista = page.getByRole('list', { name: 'Productos del carrito' });
      await expect(lista.getByRole('heading', { name: nombre })).toBeVisible();
      await expect(lista.getByText('Q199.00').first()).toBeVisible();
      await expect(page.getByRole('link', { name: /Carrito/ })).toContainText('1');

      await lista.getByRole('button', { name: 'Agregar uno' }).click();
      await expect(lista.getByText('Q398.00')).toBeVisible();
      await expect(page.getByRole('link', { name: /Carrito/ })).toContainText('2');

      await lista.getByRole('button', { name: `Eliminar ${nombre}` }).click();
      await expect(page.getByText('Tu carrito está vacío')).toBeVisible();
    },
  );
});

prueba.describe('cupón del carrito (M3-H03)', () => {
  prueba(
    'con los cupones de la semilla, la pantalla muestra el mensaje del backend: vencido y mínimo no alcanzado',
    async ({ page, crearEnTienda }) => {
      const nombre = `Gorra ${nombreUnico('cupon')}`;
      const idProducto = await crearEnTienda(nombre, [
        { valores: [], precio: '99.00', existencia: 5 },
      ]);
      await page.goto(`/productos/${String(idProducto)}`);
      await page.getByRole('button', { name: 'Agregar al carrito' }).click();
      await expect(page.getByText('Agregado al carrito')).toBeVisible();
      await page.goto('/carrito');

      const cupon = page.getByLabel('¿Tienes un cupón?');
      await cupon.fill('DEMOVENCIDO');
      await page.getByRole('button', { name: 'Aplicar' }).click();
      await expect(page.getByRole('alert')).toContainText('El cupón ya venció.');

      await cupon.fill('DEMOMINIMO');
      await page.getByRole('button', { name: 'Aplicar' }).click();
      await expect(page.getByRole('alert')).toContainText('no alcanza la compra mínima');
      await expect(page.getByText(/^Te faltan Q[\d,]+\.\d{2}\.$/)).toBeVisible();
    },
  );
});

prueba.describe('continuar al pago y fusión (M3-H04, N-05)', () => {
  prueba(
    'un invitado agrega un producto, pulsa «Continuar al pago», inicia sesión y llega a /checkout con su producto',
    async ({ page, crearEnTienda }) => {
      const nombre = `Gorra ${nombreUnico('fusion')}`;
      const idProducto = await crearEnTienda(nombre, [
        { valores: [], precio: '149.00', existencia: 5 },
      ]);
      await page.goto(`/productos/${String(idProducto)}`);
      await page.getByRole('button', { name: 'Agregar al carrito' }).click();
      await expect(page.getByText('Agregado al carrito')).toBeVisible();
      await page.goto('/carrito');

      await page.getByRole('button', { name: 'Continuar al pago' }).click();
      await expect(page).toHaveURL(/\/ingresar\?volver=%2Fcheckout$/);
      const cliente = clienteDeLaCorrida();
      await page.getByLabel('Correo electrónico').fill(cliente.correo);
      await page.getByLabel('Contraseña').fill(cliente.contrasena);
      await page.getByRole('button', { name: 'Ingresar' }).click();

      await expect(page).toHaveURL(/\/checkout$/);
      await page.goto('/carrito');
      const lista = page.getByRole('list', { name: 'Productos del carrito' });
      await expect(lista.getByRole('heading', { name: nombre })).toBeVisible();

      // El carrito del cliente de la corrida queda como estaba.
      await lista.getByRole('button', { name: `Eliminar ${nombre}` }).click();
      await expect(lista.getByRole('heading', { name: nombre })).toBeHidden();
    },
  );
});
