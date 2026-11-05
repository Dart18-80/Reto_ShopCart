// Datos de la tienda que crean las E2E por la API pública (FE-12): productos propios de la corrida que se
// desactivan al terminar cada prueba.
import type { APIRequestContext } from '@playwright/test';
import { expect, nombreUnico, test } from './fixtures';

const RUTA_ENTRADAS = '/api/v1/inventario/entradas';

interface Atributo {
  nombre: string;
  valores: { idValorAtributo: number; valor: string }[];
}

export interface VarianteNueva {
  valores: number[];
  precio: string;
  /** Unidades que entran al inventario; sin ellas, la variante queda Agotada. */
  existencia?: number;
}

/** Un valor de un atributo de la semilla (FE-16: el atributo llamado Color es el color de la prenda). */
export async function valorDeLaSemilla(
  apiAdmin: APIRequestContext,
  atributo: string,
  valor: string,
) {
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

export type CrearEnTienda = (nombre: string, variantes?: VarianteNueva[]) => Promise<number>;

/**
 * Las pruebas corren contra la tienda real: al terminar, lo que crearon se desactiva (primero el producto y después
 * la categoría, N-14) para que no quede en la tienda ni en los chips de categoría.
 */
export const prueba = test.extend<{ crearEnTienda: CrearEnTienda }>({
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
