import type { APIRequestContext } from '@playwright/test';
import { expect, nombreUnico, test } from './fixtures';

interface Atributo {
  nombre: string;
  valores: { idValorAtributo: number; valor: string }[];
}

/** El valor «Azul» del atributo Color de la semilla (FE-16: el atributo llamado Color es el color de la prenda). */
async function idDelAzul(apiAdmin: APIRequestContext): Promise<number> {
  const respuesta = await apiAdmin.get('/api/v1/admin/atributos');
  const { datos } = (await respuesta.json()) as { datos: Atributo[] };
  const azul = datos
    .find((atributo) => atributo.nombre === 'Color')
    ?.valores.find((valor) => valor.valor === 'Azul');
  if (azul === undefined) throw new Error('Falta el color Azul de la semilla');
  return azul.idValorAtributo;
}

/** Una categoría y un producto propios de la corrida, con una variante con precio (sin existencia: Agotado). */
async function productoEnTienda(
  apiAdmin: APIRequestContext,
  nombre: string,
  { valores = [], precio = '249.90' }: { valores?: number[]; precio?: string } = {},
) {
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
  const variante = await apiAdmin.post(
    `/api/v1/admin/productos/${String(datos.idProducto)}/variantes`,
    { data: { sku: nombreUnico('sku').slice(-40), valores, precio } },
  );
  expect(variante.status()).toBe(201);
  return { idProducto: datos.idProducto, idCategoria: creada.idCategoria };
}

type CrearEnTienda = (
  nombre: string,
  opciones?: { valores?: number[]; precio?: string },
) => Promise<void>;

/**
 * Las pruebas corren contra la tienda real: al terminar, lo que crearon se desactiva (primero el producto y después
 * la categoría, N-14) para que no quede en la tienda ni en los chips de categoría.
 */
const prueba = test.extend<{ crearEnTienda: CrearEnTienda }>({
  crearEnTienda: async ({ apiAdmin }, usar) => {
    const creados: { idProducto: number; idCategoria: number }[] = [];
    await usar(async (nombre, opciones) => {
      creados.push(await productoEnTienda(apiAdmin, nombre, opciones));
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
      await crearEnTienda(nombre, {
        valores: [await idDelAzul(apiAdmin)],
        precio: '249.90',
      });

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
