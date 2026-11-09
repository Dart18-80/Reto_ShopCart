import type { Page } from '@playwright/test';
import type { Respuesta } from '../src/shared/api';
import {
  clienteDeLaCorrida,
  crearAdministrador,
  expect,
  iniciarSesionPorApi,
  test,
} from './fixtures';

// D4 (03-backlog, pase de diseño): pruebas solo del diseño. Ingresar cabe sin scroll en los tamaños de la revisión
// y ninguna pantalla de la tienda se desplaza a lo ancho en un teléfono de 360 px.

const TAMANOS_INGRESAR = [
  { width: 1366, height: 657 },
  { width: 1280, height: 720 },
  { width: 375, height: 667 },
  { width: 360, height: 640 },
] as const;

const TELEFONO_ANGOSTO = { width: 360, height: 640 } as const;

/** Lo que la página mide más allá de la ventana, en cada eje (0 si cabe). */
const desborde = (page: Page) =>
  page.evaluate(() => {
    const raiz = document.documentElement;
    return {
      alto: raiz.scrollHeight - raiz.clientHeight,
      ancho: raiz.scrollWidth - raiz.clientWidth,
    };
  });

async function ingresarComoCliente(page: Page) {
  const { correo, contrasena } = clienteDeLaCorrida();
  const ingresar = () => page.request.post('/api/v1/auth/login', { data: { correo, contrasena } });
  let respuesta = await ingresar();
  if (respuesta.status() === 429) {
    const segundos = Number(respuesta.headers()['retry-after'] ?? '60');
    await page.waitForTimeout(segundos * 1000);
    respuesta = await ingresar();
  }
  expect(respuesta.status()).toBe(200);
}

async function abrir(page: Page, ruta: string) {
  await page.goto(ruta);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test.describe('Ingresar sin scroll (D4)', () => {
  for (const tamano of TAMANOS_INGRESAR) {
    test(`en ${String(tamano.width)}×${String(tamano.height)}`, async ({ page }) => {
      await page.setViewportSize(tamano);

      await abrir(page, '/ingresar');

      expect((await desborde(page)).alto).toBeLessThanOrEqual(0);
    });
  }

  test('Registro deja el botón a la vista en 1366×657', async ({ page }) => {
    await page.setViewportSize(TAMANOS_INGRESAR[0]);

    await abrir(page, '/registro');

    await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeInViewport();
  });
});

test.describe('la tienda sin scroll horizontal en 360 px (D4)', () => {
  test.use({ viewport: TELEFONO_ANGOSTO });

  for (const ruta of ['/', '/carrito', '/ingresar', '/registro']) {
    test(`invitado: ${ruta}`, async ({ page }) => {
      await abrir(page, ruta);

      expect((await desborde(page)).ancho).toBeLessThanOrEqual(0);
    });
  }

  test('invitado: el detalle de un producto', async ({ page }) => {
    await abrir(page, '/');
    await page
      .getByRole('link')
      .filter({ has: page.getByRole('heading', { level: 2 }) })
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    expect((await desborde(page)).ancho).toBeLessThanOrEqual(0);
  });

  // Un solo ingreso para las tres pantallas. El login admite 5 intentos por minuto por correo (A-07) y este
  // proyecto corre justo después de los demás: si responde 429, se espera lo que dice Retry-After y se reintenta.
  test('Cliente: mis pedidos, su perfil y sus direcciones', async ({ page }) => {
    test.setTimeout(120_000);
    await ingresarComoCliente(page);

    for (const ruta of ['/pedidos', '/cuenta/perfil', '/cuenta/direcciones']) {
      await abrir(page, ruta);

      expect((await desborde(page)).ancho, ruta).toBeLessThanOrEqual(0);
    }
  });
});

// D6: el encabezado de una tabla se queda fijo arriba de la ventana desde 1024 px solo si la tabla cabe a lo ancho;
// si no, la tabla se desplaza a lo ancho en su tarjeta con encabezado normal. Pagos en revisión no tiene filas en un
// entorno recién levantado (las crea la conciliación), así que su lista llega de un fixture con el tipo del contrato
// y valores largos de verdad (correos y transacciones); la tabla que se mide es la real.
const PAGOS_EN_REVISION: Respuesta<'/api/v1/admin/pagos/en-revision', 'get'> = {
  datos: [1, 2, 3].map((n) => ({
    idIntentoPago: 9000 + n,
    idPedido: n === 3 ? null : 1500 + n,
    numeroPedido: n === 3 ? null : `SC-00${String(1500 + n)}`,
    cliente: {
      idUsuario: 700 + n,
      nombre: `Cliente de revisión ${String(n)} con apellidos largos`,
      correo: `cliente.revision.${String(n)}@correo-de-prueba.gt`,
    },
    monto: '12345.67',
    idTransaccion: `tx-0f1e2d3c-4b5a-6978-8a9b-${String(n).padStart(12, '0')}`,
    tarjeta: { marca: 'Visa', ultimosDigitos: '4242' },
    causa: n === 3 ? 'CobroSinPedido' : 'AutorizacionInexistente',
    fecha: '2026-11-09T14:07:00.000Z',
  })),
  paginacion: { pagina: 1, tamano: 20, total: 3, totalPaginas: 1 },
};

test.describe('Pagos en revisión con filas: encabezado fijo solo si la tabla cabe (D6)', () => {
  for (const ancho of [1024, 1280]) {
    test(`en ${String(ancho)} px`, async ({ page, apiAdmin }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      await iniciarSesionPorApi(page, await crearAdministrador(apiAdmin));
      await page.route('**/api/v1/admin/pagos/en-revision**', (ruta) =>
        ruta.fulfill({ json: PAGOS_EN_REVISION }),
      );

      await abrir(page, '/backoffice/pagos-en-revision');

      const tabla = page.getByRole('table', { name: 'Pagos en revisión' });
      await expect(tabla.getByRole('row')).toHaveCount(1 + PAGOS_EN_REVISION.datos.length);
      // La medida se toma cuando ResizeObserver ya decidió: encabezado fijo si y solo si la tabla cabe.
      const medir = () =>
        tabla.evaluate((t) => {
          const caja = t.parentElement;
          const encabezado = t.querySelector('thead');
          if (!caja || !encabezado || !(t instanceof HTMLElement)) return null;
          return {
            cabe: t.offsetWidth <= caja.clientWidth,
            encabezado: getComputedStyle(encabezado).position,
            desplazamiento: getComputedStyle(caja).overflowX,
          };
        });
      await expect
        .poll(async () => {
          const m = await medir();
          return (
            m !== null &&
            m.cabe === (m.encabezado === 'sticky') &&
            m.cabe !== (m.desplazamiento === 'auto')
          );
        })
        .toBe(true);
      const medida = await medir();
      test.info().annotations.push({
        type: 'medida',
        description: `${String(ancho)} px: cabe=${String(medida?.cabe)}, encabezado ${String(medida?.encabezado)}`,
      });
    });
  }
});
