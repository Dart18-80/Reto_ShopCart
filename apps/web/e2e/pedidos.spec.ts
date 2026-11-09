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
  crearOperador,
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

const CICLO_HASTA_ENTREGADO = [
  ['Pasar a En preparación', ''],
  ['Marcar como despachado', 'Guía 4521'],
  ['Marcar como entregado', ''],
] as const;

/** Lleva el pedido abierto de Pagado a Entregado con los botones de la gestión (M8-H03). */
async function entregarDesdeLaGestion(operador: Page) {
  for (const [accion, motivo] of CICLO_HASTA_ENTREGADO) {
    await operador.getByRole('button', { name: accion }).click();
    const dialogo = operador.getByRole('dialog', { name: accion });
    if (motivo !== '') await dialogo.getByLabel('Motivo (opcional)').fill(motivo);
    await dialogo.getByRole('button', { name: accion }).click();
    await expect(dialogo).toBeHidden();
  }
}

pruebaDeCompra.describe('gestión de pedidos (M8)', () => {
  pruebaDeCompra(
    'un Operador lleva un pedido de Pagado a Entregado y el historial registra cada paso con su rol (M8-H03)',
    async ({ browser, apiAdmin, crearEnTienda, comprador }, informacion) => {
      const idProducto = await crearEnTienda(`Gorra ${nombreUnico('ciclo')}`, [
        { valores: [], precio: '80.00', existencia: 5 },
      ]);
      await agregarAlCarrito(comprador.api, await varianteDe(comprador.api, idProducto));
      await direccionDe(comprador.api);
      const idPedido = await comprarCarrito(comprador.api);
      const numero = `SC-${String(idPedido).padStart(6, '0')}`;

      const contexto = await browser.newContext({ baseURL: informacion.project.use.baseURL });
      const operador = await contexto.newPage();
      try {
        await iniciarSesionPorApi(operador, await crearOperador(apiAdmin));
        await operador.goto('/backoffice/pedidos?estado=Pagado');
        await operador.getByRole('link', { name: numero }).click();
        await expect(operador.getByRole('heading', { name: `Pedido ${numero}` })).toBeVisible();

        await entregarDesdeLaGestion(operador);

        await expect(operador.getByRole('heading', { level: 1 }).locator('..')).toContainText(
          'Entregado',
        );
        const historial = operador.getByRole('region', { name: 'Historial' });
        for (const estado of ['En preparación', 'Despachado', 'Entregado']) {
          await expect(historial.getByRole('listitem').filter({ hasText: estado })).toContainText(
            '· Operador',
          );
        }
        await expect(historial).toContainText('Motivo: Guía 4521');
        await expect(operador.getByRole('button', { name: /Pasar a|Marcar como/ })).toBeHidden();
      } finally {
        await contexto.close();
      }
    },
  );

  pruebaDeCompra(
    'una devolución parcial deja el pedido en Devuelto parcial y el kardex muestra el reingreso (M8-H04)',
    async ({ browser, apiAdmin, crearEnTienda, comprador }, informacion) => {
      const marca = nombreUnico('devolucion');
      const idProducto = await crearEnTienda(`Gorra ${marca}`, [
        { valores: [], precio: '60.00', existencia: 5 },
      ]);
      await agregarAlCarrito(comprador.api, await varianteDe(comprador.api, idProducto), 2);
      await direccionDe(comprador.api);
      const idPedido = await comprarCarrito(comprador.api);

      const contexto = await browser.newContext({ baseURL: informacion.project.use.baseURL });
      const operador = await contexto.newPage();
      try {
        await iniciarSesionPorApi(operador, await crearOperador(apiAdmin));
        await operador.goto(`/backoffice/pedidos/${String(idPedido)}`);
        await entregarDesdeLaGestion(operador);

        await operador.getByRole('button', { name: 'Registrar devolución' }).click();
        const dialogo = operador.getByRole('dialog', { name: 'Registrar devolución' });
        await dialogo.getByRole('combobox', { name: new RegExp(marca) }).selectOption('1');
        await dialogo.getByLabel('Motivo').fill('Talla equivocada');
        await dialogo.getByRole('button', { name: 'Registrar devolución' }).click();

        await expect(operador.getByText(/^Registramos la devolución\. /)).toBeVisible();
        await expect(operador.getByRole('heading', { level: 1 }).locator('..')).toContainText(
          'Devuelto parcial',
        );

        await operador.goto(`/backoffice/inventario?texto=${encodeURIComponent(marca)}`);
        const fila = operador.getByRole('table', { name: 'Existencias' }).getByRole('row').nth(1);
        const sku = (await fila.getByRole('cell').first().innerText()).trim();
        await expect(fila.getByRole('cell').nth(2)).toHaveText('4');
        await operador.getByRole('button', { name: `Ver kardex de ${sku}` }).click();
        const kardex = operador.getByRole('dialog', { name: `Kardex de ${sku}` });
        const reingreso = kardex.getByRole('row').filter({ hasText: 'Reingreso por devolución' });
        await expect(reingreso).toContainText('+1');
        await expect(reingreso.getByRole('cell').nth(3)).toHaveText('3');
        await expect(reingreso.getByRole('cell').nth(4)).toHaveText('4');
      } finally {
        await contexto.close();
      }
    },
  );
});

// Cambia un parámetro global: va en este archivo porque su proyecto corre al final y solo, así no altera las
// demás pruebas; deja el valor como estaba.
pruebaDeCompra.describe('configuración (M9-H02)', () => {
  pruebaDeCompra(
    'cambiar los minutos de reserva cambia el texto del paso 1 del checkout',
    async ({ browser, apiAdmin, crearEnTienda, comprador }, informacion) => {
      const { datos: original } = (await (
        await apiAdmin.get('/api/v1/admin/configuracion')
      ).json()) as { datos: { minutosReserva: number } };
      const nuevos = original.minutosReserva === 20 ? 25 : 20;
      const idProducto = await crearEnTienda(`Gorra ${nombreUnico('reserva')}`, [
        { valores: [], precio: '70.00', existencia: 5 },
      ]);
      await agregarAlCarrito(comprador.api, await varianteDe(comprador.api, idProducto));
      await direccionDe(comprador.api);

      const contexto = await browser.newContext({ baseURL: informacion.project.use.baseURL });
      const admin = await contexto.newPage();
      try {
        await iniciarSesionPorApi(admin, await crearAdministrador(apiAdmin));
        await admin.goto('/backoffice/configuracion');
        await admin.getByLabel('Minutos de reserva al pagar').fill(String(nuevos));
        await admin.getByRole('button', { name: 'Guardar configuración' }).click();
        await expect(admin.getByText('Guardamos la configuración.')).toBeVisible();

        await pagina.goto('/checkout');
        await expect(
          pagina.getByText(
            `Al continuar apartamos tus productos por ${String(nuevos)} minutos mientras pagas.`,
          ),
        ).toBeVisible();
      } finally {
        await contexto.close();
        await apiAdmin.patch('/api/v1/admin/configuracion', {
          data: { minutosReserva: original.minutosReserva },
        });
      }
    },
  );
});

/** El día de hoy en Guatemala (A-12), como lo espera el filtro del dashboard. */
const hoyEnGuatemala = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());

const cifraDelResumen = (admin: Page, etiqueta: string) =>
  admin
    .getByRole('region', { name: 'Resumen del periodo' })
    .locator('div', { has: admin.locator('dt', { hasText: new RegExp(`^${etiqueta}$`) }) })
    .locator('dd')
    .first();

// «Q12,500.50» → 1250050 centavos: la prueba compara cifras de la pantalla sin pasar por decimales binarios.
const centavos = (texto: string) => Number(texto.replace(/[^\d-]/g, ''));

pruebaDeCompra.describe('dashboard (M11)', () => {
  pruebaDeCompra(
    'después de un pedido de prueba, el resumen del día lo incluye',
    async ({ browser, apiAdmin, crearEnTienda, comprador }, informacion) => {
      const idProducto = await crearEnTienda(`Gorra ${nombreUnico('dashboard')}`, [
        { valores: [], precio: '80.00', existencia: 5 },
      ]);
      const hoy = hoyEnGuatemala();
      const contexto = await browser.newContext({ baseURL: informacion.project.use.baseURL });
      const admin = await contexto.newPage();
      try {
        await iniciarSesionPorApi(admin, await crearAdministrador(apiAdmin));
        await admin.goto(`/backoffice/dashboard?desde=${hoy}&hasta=${hoy}`);
        const pedidos = cifraDelResumen(admin, 'Pedidos');
        const ventas = cifraDelResumen(admin, 'Ventas netas');
        await expect(pedidos).toHaveText(/^\d[\d,]*$/);
        const pedidosAntes = Number((await pedidos.innerText()).replace(/,/g, ''));
        const ventasAntes = centavos(await ventas.innerText());

        await agregarAlCarrito(comprador.api, await varianteDe(comprador.api, idProducto));
        await direccionDe(comprador.api);
        await comprarCarrito(comprador.api);
        await admin.reload();

        await expect(pedidos).toHaveText(String(pedidosAntes + 1));
        expect(centavos(await ventas.innerText())).toBe(ventasAntes + 8000);
      } finally {
        await contexto.close();
      }
    },
  );
});
