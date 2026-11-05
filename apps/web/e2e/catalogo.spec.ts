import type { APIRequestContext } from '@playwright/test';
import { expect, nombreUnico, test } from './fixtures';

const RUTA_ENTRADAS = '/api/v1/inventario/entradas';

interface Atributo {
  nombre: string;
  valores: { idValorAtributo: number; valor: string }[];
}

interface VarianteNueva {
  valores: number[];
  precio: string;
  /** Unidades que entran al inventario; sin ellas, la variante queda Agotada. */
  existencia?: number;
}

/** Un valor de un atributo de la semilla (FE-16: el atributo llamado Color es el color de la prenda). */
async function valorDeLaSemilla(apiAdmin: APIRequestContext, atributo: string, valor: string) {
  const respuesta = await apiAdmin.get('/api/v1/admin/atributos');
  const { datos } = (await respuesta.json()) as { datos: Atributo[] };
  const encontrado = datos
    .find((a) => a.nombre === atributo)
    ?.valores.find((v) => v.valor === valor);
  if (encontrado === undefined) throw new Error(`Falta ${atributo} ${valor} en la semilla`);
  return encontrado.idValorAtributo;
}

/** Una categoría y un producto propios de la corrida, todavía sin variantes. */
async function productoNuevo(apiAdmin: APIRequestContext, nombre: string) {
  const categoria = await apiAdmin.post('/api/v1/admin/categorias', {
    data: { nombre: nombreUnico('categoria'), ilustracion: 'Camisa' },
  });
  expect(categoria.status()).toBe(201);
  const { datos: creada } = (await categoria.json()) as { datos: { idCategoria: number } };
  const producto = await apiAdmin.post('/api/v1/admin/productos', {
    data: { idCategoria: creada.idCategoria, nombre },
  });
  expect(producto.status()).toBe(201);
  const { datos } = (await producto.json()) as { datos: { idProducto: number } };
  return { idProducto: datos.idProducto, idCategoria: creada.idCategoria };
}

/** Las variantes con su precio y, si se pide, su existencia (sin ella, la variante queda Agotada). */
async function agregarVariantes(
  apiAdmin: APIRequestContext,
  idProducto: number,
  variantes: VarianteNueva[],
) {
  for (const { existencia, ...variante } of variantes) {
    const respuesta = await apiAdmin.post(
      `/api/v1/admin/productos/${String(idProducto)}/variantes`,
      {
        data: { sku: nombreUnico('sku').slice(-40), ...variante },
      },
    );
    expect(respuesta.status()).toBe(201);
    if (existencia === undefined) continue;
    const { datos } = (await respuesta.json()) as {
      datos: { variantes: { idVariante: number }[] };
    };
    const entrada = await apiAdmin.post(RUTA_ENTRADAS, {
      data: {
        idVariante: datos.variantes.at(-1)?.idVariante,
        cantidad: existencia,
        motivo: 'Existencia de la prueba E2E',
      },
    });
    expect(entrada.status()).toBe(201);
  }
}

type CrearEnTienda = (nombre: string, variantes?: VarianteNueva[]) => Promise<number>;

/**
 * Las pruebas corren contra la tienda real: al terminar, lo que crearon se desactiva (primero el producto y después
 * la categoría, N-14) para que no quede en la tienda ni en los chips de categoría.
 */
const prueba = test.extend<{ crearEnTienda: CrearEnTienda }>({
  crearEnTienda: async ({ apiAdmin }, usar) => {
    const creados: { idProducto: number; idCategoria: number }[] = [];
    await usar(async (nombre, variantes = [{ valores: [], precio: '249.90' }]) => {
      const creado = await productoNuevo(apiAdmin, nombre);
      // Se anota antes de agregar las variantes: si algo falla después, igual se desactiva.
      creados.push(creado);
      await agregarVariantes(apiAdmin, creado.idProducto, variantes);
      return creado.idProducto;
    });
    for (const { idProducto, idCategoria } of creados) {
      await apiAdmin.post(`/api/v1/admin/productos/${String(idProducto)}/desactivar`);
      await apiAdmin.post(`/api/v1/admin/categorias/${String(idCategoria)}/desactivar`);
    }
  },
});

test.describe('catálogo de la tienda (M2-H02)', () => {
  prueba(
    'buscar «camion» desde el encabezado encuentra «Camión» (A-10, de punta a punta)',
    async ({ page, crearEnTienda }) => {
      const marca = nombreUnico('juguete');
      await crearEnTienda(`Camión ${marca}`);
      await page.goto('/');

      await page.getByRole('searchbox', { name: 'Buscar productos' }).fill(`camion ${marca}`);
      await page.keyboard.press('Enter');

      await expect(page.getByRole('link', { name: new RegExp(`Camión ${marca}`) })).toBeVisible();
      await expect(page).toHaveURL(/texto=camion/);
    },
  );

  prueba(
    'un producto creado por la API con una variante Azul aparece con la prenda azul y su precio',
    async ({ page, apiAdmin, crearEnTienda }) => {
      const nombre = `Camisa ${nombreUnico('azul')}`;
      const azul = await valorDeLaSemilla(apiAdmin, 'Color', 'Azul');
      await crearEnTienda(nombre, [{ valores: [azul], precio: '249.90' }]);

      await page.goto(`/?texto=${encodeURIComponent(nombre)}`);

      const tarjeta = page.getByRole('link', { name: new RegExp(nombre) });
      await expect(tarjeta.getByRole('img', { name: 'Camisa color Azul' })).toBeVisible();
      await expect(tarjeta.getByText('Q249.90')).toBeVisible();
      await expect(tarjeta.getByText('Agotado')).toBeVisible();
    },
  );

  test('filtrar y ordenar cambia la URL, recargar conserva la vista y «atrás» vuelve a la anterior', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Ordenar' }).selectOption('Precio: de mayor a menor');
    await expect(page).toHaveURL(/orden=precio&direccion=desc/);

    // La casilla refleja la URL: se marca cuando la URL ya cambió (por eso click y no check).
    await page.getByRole('checkbox', { name: 'Solo con existencia' }).click();
    await expect(page).toHaveURL(/disponible=true/);
    await expect(page.getByRole('checkbox', { name: 'Solo con existencia' })).toBeChecked();

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Ordenar' })).toHaveValue('precio-desc');
    await expect(page.getByRole('checkbox', { name: 'Solo con existencia' })).toBeChecked();

    await page.goBack();
    await expect(page).not.toHaveURL(/disponible=true/);
    await expect(page.getByRole('checkbox', { name: 'Solo con existencia' })).not.toBeChecked();
  });
});

test.describe('detalle de producto (M2-H03)', () => {
  prueba(
    'elegir color y talla muestra el precio de esa variante y la guarda en la URL',
    async ({ page, apiAdmin, crearEnTienda }) => {
      const [azul, negro, m, l] = await Promise.all([
        valorDeLaSemilla(apiAdmin, 'Color', 'Azul'),
        valorDeLaSemilla(apiAdmin, 'Color', 'Negro'),
        valorDeLaSemilla(apiAdmin, 'Talla', 'M'),
        valorDeLaSemilla(apiAdmin, 'Talla', 'L'),
      ]);
      const idProducto = await crearEnTienda(`Camisa ${nombreUnico('detalle')}`, [
        { valores: [m, azul], precio: '249.90', existencia: 10 },
        { valores: [l, azul], precio: '279.90', existencia: 10 },
        { valores: [m, negro], precio: '259.90', existencia: 10 },
      ]);

      await page.goto(`/productos/${String(idProducto)}`);
      await expect(page.getByRole('button', { name: 'Elige talla y color' })).toBeDisabled();
      await page.getByRole('button', { name: 'Azul' }).click();
      await page.getByRole('group', { name: 'Talla' }).getByRole('button', { name: 'L' }).click();

      await expect(page.getByText('Q279.90')).toBeVisible();
      await expect(page.getByRole('img', { name: 'Camisa color Azul' }).first()).toBeVisible();
      await expect(page).toHaveURL(/variante=\d+/);

      await page.reload();
      await expect(page.getByText('Q279.90')).toBeVisible();
    },
  );
});
