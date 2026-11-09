import { http, HttpResponse } from 'msw';
import type { Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

type Resumen = Respuesta<'/api/v1/dashboard/resumen', 'get'>['datos'];
type VentasDelPeriodo = Respuesta<'/api/v1/dashboard/ventas', 'get'>['datos'][number];
type VentasDeCategoria = Respuesta<
  '/api/v1/dashboard/ventas-por-categoria',
  'get'
>['datos'][number];
type ProductoVendido = Respuesta<'/api/v1/dashboard/top-productos', 'get'>['datos'][number];
type CarritoAbandonado = Respuesta<
  '/api/v1/dashboard/carritos-abandonados',
  'get'
>['datos'][number];

export type ReporteDelDashboard = 'resumen' | 'ventas' | 'categorias' | 'top' | 'carritos';

const RUTA: Record<ReporteDelDashboard, string> = {
  resumen: '/api/v1/dashboard/resumen',
  ventas: '/api/v1/dashboard/ventas',
  categorias: '/api/v1/dashboard/ventas-por-categoria',
  top: '/api/v1/dashboard/top-productos',
  carritos: '/api/v1/dashboard/carritos-abandonados',
};

export const resumenDePrueba = (cambios: Partial<Resumen> = {}): Resumen => ({
  desde: '2026-10-10',
  hasta: '2026-11-08',
  ventas: '12500.50',
  pedidos: 42,
  ticketPromedio: '297.63',
  unidades: 96,
  devoluciones: '320.00',
  envio: '735.00',
  carritosAbandonados: 7,
  montoPotencialPerdido: '2150.00',
  ...cambios,
});

export const VENTAS_DE_PRUEBA: VentasDelPeriodo[] = [
  { periodo: '2026-11-06', ventas: '1500.50', pedidos: 3 },
  { periodo: '2026-11-07', ventas: '-120.00', pedidos: 0 },
];

export const CATEGORIAS_DE_PRUEBA: VentasDeCategoria[] = [
  { idCategoria: 4, categoria: 'Camisas', unidades: 12, ventas: '980.00' },
  { idCategoria: 2, categoria: 'Gorras', unidades: 3, ventas: '105.00' },
];

export const TOP_DE_PRUEBA: ProductoVendido[] = [
  { idProducto: 9, producto: 'Camisa Oxford', unidades: 7, ventas: '1050.00' },
];

export const carritoDePrueba = (cambios: Partial<CarritoAbandonado> = {}): CarritoAbandonado => ({
  idCarrito: 31,
  cliente: { idUsuario: 5, nombre: 'Carla Cliente' },
  fechaUltimaActividad: '2026-11-06T16:00:00.000Z',
  lineas: 2,
  unidades: 3,
  montoPotencial: '450.00',
  ...cambios,
});

const TOTAL_CARRITOS = 45;

interface OpcionesDashboard {
  /** Los reportes que responden 500, para ver que cada uno tiene sus propios estados. */
  fallan?: readonly ReporteDelDashboard[];
  ventas?: VentasDelPeriodo[];
  carritos?: CarritoAbandonado[];
}

/**
 * Los cinco reportes del dashboard. Devuelve, por reporte, las consultas recibidas (sus parámetros), para verificar
 * que el rango y la agrupación de la URL llegan al servidor.
 */
export function simularDashboard({
  fallan = [],
  ventas = VENTAS_DE_PRUEBA,
  carritos = [carritoDePrueba()],
}: OpcionesDashboard = {}) {
  const consultas: Record<ReporteDelDashboard, URLSearchParams[]> = {
    resumen: [],
    ventas: [],
    categorias: [],
    top: [],
    carritos: [],
  };
  const responder = (reporte: ReporteDelDashboard, cuerpo: () => object) =>
    http.get(RUTA[reporte], ({ request }) => {
      consultas[reporte].push(new URL(request.url).searchParams);
      if (fallan.includes(reporte)) {
        return HttpResponse.json(
          {
            error: {
              codigo: 'ERROR_INTERNO',
              mensaje: 'No pudimos cargar el reporte.',
              requestId: 'req-rep',
            },
          },
          { status: 500 },
        );
      }
      return HttpResponse.json(cuerpo());
    });

  servidor.use(
    responder('resumen', () => ({ datos: resumenDePrueba() })),
    responder('ventas', () => ({ datos: ventas })),
    responder('categorias', () => ({ datos: CATEGORIAS_DE_PRUEBA })),
    responder('top', () => ({ datos: TOP_DE_PRUEBA })),
    responder('carritos', () => ({
      datos: carritos,
      // Tres páginas de 20, para que una página 2 en la URL sea válida.
      paginacion: { pagina: 1, tamano: 20, total: TOTAL_CARRITOS, totalPaginas: 3 },
    })),
  );
  return consultas;
}
