import type { paths } from '@shopcart/contrato';
import { delay, http, HttpResponse } from 'msw';
import { api, type Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

type RespuestaBusqueda = Respuesta<'/api/v1/productos', 'get'>;
export type ProductoBusqueda = RespuestaBusqueda['datos'][number];

const RUTA = '/api/v1/productos';

type ConsultaBusqueda = paths['/api/v1/productos']['get']['parameters']['query'];

/**
 * La llamada que haría `catalogo.api.ts` (llega con el módulo Catálogo). Vive aquí porque un componente nunca
 * importa `api` (FE-09), tampoco en sus pruebas.
 */
export async function buscarProductosDePrueba(query?: ConsultaBusqueda) {
  const { data } = await api.GET(RUTA, { params: { query } });
  if (!data)
    throw new Error('El middleware de errores convierte toda respuesta de error en ErrorApi.');
  return data;
}

export const productoDePrueba = (numero: number): ProductoBusqueda => ({
  idProducto: numero,
  nombre: `Producto ${String(numero)}`,
  idCategoria: 1,
  categoria: 'Camisas y blusas',
  precioMinimo: `${String(100 + numero)}.00`,
  disponible: true,
  imagenPrincipal: null,
  ilustracion: 'Camisa',
  colores: [],
});

interface OpcionesBusqueda {
  /** Cuántos productos hay en total: fijo, o según la consulta (por ejemplo, menos con un filtro). */
  total: number | ((consulta: URLSearchParams) => number);
  /** Espera antes de responder a partir de la segunda petición (para ver «Actualizando…»). */
  demoraDespuesDeLaPrimera?: number;
}

/** `GET /api/v1/productos` simulado: pagina con `pagina` y `tamano`; guarda la consulta de cada petición. */
export function simularBusquedaProductos({
  total: totalPedido,
  demoraDespuesDeLaPrimera,
}: OpcionesBusqueda) {
  const consultas: URLSearchParams[] = [];
  servidor.use(
    http.get(RUTA, async ({ request }) => {
      const consulta = new URL(request.url).searchParams;
      consultas.push(consulta);
      if (demoraDespuesDeLaPrimera !== undefined && consultas.length > 1) {
        await delay(demoraDespuesDeLaPrimera);
      }
      const total = typeof totalPedido === 'number' ? totalPedido : totalPedido(consulta);
      const pagina = Number(consulta.get('pagina') ?? '1');
      const tamano = Number(consulta.get('tamano') ?? '20');
      const desde = (pagina - 1) * tamano;
      const cuantos = Math.max(0, Math.min(tamano, total - desde));
      return HttpResponse.json<RespuestaBusqueda>({
        datos: Array.from({ length: cuantos }, (_, i) => productoDePrueba(desde + i + 1)),
        paginacion: { pagina, tamano, total, totalPaginas: Math.ceil(total / tamano) },
      });
    }),
  );
  return { consultas };
}

/** `GET /api/v1/productos` que falla con el formato de A-06 (por defecto, un 500 del backend). */
export function simularBusquedaFallida(
  requestId: string,
  { status = 500, codigo = 'ERROR_INTERNO', mensaje = 'El servicio de búsqueda falló.' } = {},
) {
  servidor.use(
    http.get(RUTA, () => HttpResponse.json({ error: { codigo, mensaje, requestId } }, { status })),
  );
}

type Categoria = Respuesta<'/api/v1/categorias', 'get'>['datos'][number];

export const CATEGORIAS_DE_PRUEBA: Categoria[] = [
  { idCategoria: 1, nombre: 'Camisas y blusas', descripcion: null, ilustracion: 'Camisa' },
  { idCategoria: 5, nombre: 'Calzado', descripcion: null, ilustracion: 'Tenis' },
];

/** `GET /api/v1/categorias` con las categorías activas de la tienda. */
export function simularCategorias(categorias: Categoria[] = CATEGORIAS_DE_PRUEBA) {
  servidor.use(http.get('/api/v1/categorias', () => HttpResponse.json({ datos: categorias })));
}

/** `GET /api/v1/productos` que responde siempre estos productos en una sola página; guarda cada consulta. */
export function simularProductos(productos: ProductoBusqueda[]) {
  const consultas: URLSearchParams[] = [];
  servidor.use(
    http.get(RUTA, ({ request }) => {
      consultas.push(new URL(request.url).searchParams);
      return HttpResponse.json<RespuestaBusqueda>({
        datos: productos,
        paginacion: { pagina: 1, tamano: 20, total: productos.length, totalPaginas: 1 },
      });
    }),
  );
  return { consultas };
}

type ProductoTienda = Respuesta<'/api/v1/productos/{id}', 'get'>['datos'];
type VarianteTienda = ProductoTienda['variantes'][number];

const TALLAS = { S: 10, M: 11, L: 12, XL: 13 } as const;
const COLORES = { Celeste: 20, Blanco: 21, Azul: 22 } as const;

/** Una variante con talla y color de la semilla; el precio y la existencia se pueden cambiar. */
export const varianteDePrueba = (
  idVariante: number,
  talla: keyof typeof TALLAS,
  color: keyof typeof COLORES,
  cambios: Partial<VarianteTienda> = {},
): VarianteTienda => ({
  idVariante,
  sku: `OXF-${talla}-${color}`,
  descripcionAtributos: `${talla} / ${color}`,
  precio: '249.00',
  estadoExistencia: 'Disponible',
  valores: [
    { idAtributo: 1, atributo: 'Talla', idValorAtributo: TALLAS[talla], valor: talla },
    { idAtributo: 2, atributo: 'Color', idValorAtributo: COLORES[color], valor: color },
  ],
  ...cambios,
});

/** La Camisa Oxford del frame 24:314: XL agotada en Azul, Celeste solo en S y M. */
export const productoDetalleDePrueba = (cambios: Partial<ProductoTienda> = {}): ProductoTienda => ({
  idProducto: 50,
  idCategoria: 1,
  categoria: 'Camisas y blusas',
  ilustracion: 'Camisa',
  nombre: 'Camisa Oxford',
  descripcion: 'Camisa de algodón Oxford con cuello de botones.',
  diasGarantiaPrecio: 3,
  imagenes: [],
  variantes: [
    varianteDePrueba(1, 'S', 'Celeste'),
    varianteDePrueba(2, 'M', 'Celeste'),
    varianteDePrueba(3, 'S', 'Blanco'),
    varianteDePrueba(4, 'M', 'Blanco', { precio: '259.00' }),
    varianteDePrueba(5, 'L', 'Blanco', {
      estadoExistencia: 'UltimasUnidades',
      unidadesRestantes: 2,
    }),
    varianteDePrueba(6, 'S', 'Azul'),
    varianteDePrueba(7, 'M', 'Azul'),
    varianteDePrueba(8, 'L', 'Azul'),
    varianteDePrueba(9, 'XL', 'Azul', { estadoExistencia: 'Agotado' }),
  ],
  ...cambios,
});

/** `GET /api/v1/productos/{id}` que responde el producto indicado, o un error con el formato de A-06. */
export function simularProducto(producto: ProductoTienda = productoDetalleDePrueba()) {
  servidor.use(
    http.get('/api/v1/productos/:id', ({ params }) =>
      String(params.id) === String(producto.idProducto)
        ? HttpResponse.json({ datos: producto })
        : HttpResponse.json(
            {
              error: {
                codigo: 'NO_ENCONTRADO',
                mensaje: 'El producto no existe.',
                requestId: 'req-404',
              },
            },
            { status: 404 },
          ),
    ),
  );
}

export function simularProductoFallido(requestId: string) {
  servidor.use(
    http.get('/api/v1/productos/:id', () =>
      HttpResponse.json(
        {
          error: { codigo: 'ERROR_INTERNO', mensaje: 'No pudimos cargar el producto.', requestId },
        },
        { status: 500 },
      ),
    ),
  );
}
