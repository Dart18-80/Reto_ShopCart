import { http, HttpResponse } from 'msw';
import type { Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

type ListaCupones = Respuesta<'/api/v1/admin/cupones', 'get'>;
export type CuponDePrueba = ListaCupones['datos'][number];

interface ErrorSimulado {
  status: number;
  codigo: string;
  mensaje: string;
  detalles?: unknown;
}

const responderError = ({ status, ...error }: ErrorSimulado) =>
  HttpResponse.json({ error: { ...error, requestId: 'req-cup' } }, { status });

export const cuponDePrueba = (cambios: Partial<CuponDePrueba> = {}): CuponDePrueba => ({
  idCupon: 5,
  codigo: 'VERANO10',
  descripcion: 'Verano en la tienda',
  tipo: 'Porcentaje',
  valor: '10.00',
  montoMaximoDescuento: '50.00',
  montoMinimoCompra: '0.00',
  categoria: null,
  fechaInicio: '2026-11-01T06:00:00.000Z',
  fechaFin: '2026-12-01T05:59:00.000Z',
  limiteUsosTotal: 100,
  limiteUsosPorCliente: 1,
  usosComprometidos: 3,
  usado: true,
  activo: true,
  ...cambios,
});

export interface Recibido {
  metodo: string;
  ruta: string;
  cuerpo?: unknown;
}

/**
 * `GET /admin/cupones` con la lista que haya en cada momento, y el alta, la edición y los cambios de estado. Un
 * error por `"METODO ruta"` (`POST crear`, `PATCH editar`, `POST activar`) reemplaza la respuesta. Guarda las
 * consultas y lo recibido.
 */
export function simularCupones(
  iniciales: CuponDePrueba[],
  errores: Partial<Record<string, ErrorSimulado>> = {},
) {
  let cupones = [...iniciales];
  const consultas: URLSearchParams[] = [];
  const recibidos: Recibido[] = [];
  const anotar = (metodo: string, ruta: string, cuerpo?: unknown) => {
    recibidos.push(cuerpo === undefined ? { metodo, ruta } : { metodo, ruta, cuerpo });
    return errores[`${metodo} ${ruta}`];
  };
  const cambiar = (id: number, cambios: Partial<CuponDePrueba>) => {
    cupones = cupones.map((c) => (c.idCupon === id ? { ...c, ...cambios } : c));
    return cupones.find((c) => c.idCupon === id);
  };
  servidor.use(
    http.get('/api/v1/admin/cupones', ({ request }) => {
      consultas.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        datos: cupones,
        paginacion: { pagina: 1, tamano: 20, total: cupones.length, totalPaginas: 1 },
      });
    }),
    http.post('/api/v1/admin/cupones', async ({ request }) => {
      const cuerpo = await request.json();
      const error = anotar('POST', 'crear', cuerpo);
      if (error) return responderError(error);
      const nuevo = cuponDePrueba({ idCupon: 99, codigo: 'NUEVO', usosComprometidos: 0 });
      cupones = [nuevo, ...cupones];
      return HttpResponse.json({ datos: nuevo }, { status: 201 });
    }),
    http.patch('/api/v1/admin/cupones/:id', async ({ request, params }) => {
      const cuerpo = await request.json();
      const error = anotar('PATCH', 'editar', cuerpo);
      if (error) return responderError(error);
      return HttpResponse.json({ datos: cambiar(Number(params.id), {}) });
    }),
    http.post('/api/v1/admin/cupones/:id/:accion', ({ params }) => {
      const accion = String(params.accion);
      const error = anotar('POST', accion);
      if (error) return responderError(error);
      return HttpResponse.json({
        datos: cambiar(Number(params.id), { activo: accion === 'activar' }),
      });
    }),
  );
  return { consultas, recibidos };
}
