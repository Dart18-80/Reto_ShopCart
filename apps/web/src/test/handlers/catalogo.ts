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
