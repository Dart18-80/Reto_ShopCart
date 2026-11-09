import { http, HttpResponse } from 'msw';
import type { Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

type Exportacion = Respuesta<'/api/v1/admin/exportaciones', 'get'>['datos'][number];

export const exportacionDePrueba = (cambios: Partial<Exportacion> = {}): Exportacion => ({
  idExportacion: 7,
  reporte: 'ventas',
  formato: 'xlsx',
  filtros: { desde: '2026-11-01', hasta: '2026-11-08', agrupacion: 'dia' },
  estado: 'Completada',
  intentos: 1,
  error: null,
  tamanoBytes: 2048,
  fechaCreacion: '2026-11-08T16:00:00.000Z',
  fechaFinalizacion: '2026-11-08T16:00:03.000Z',
  fechaExpiracion: '2026-11-09T16:00:03.000Z',
  archivo: '/api/v1/admin/exportaciones/7/archivo',
  ...cambios,
});

const EN_CURSO = { 'Retry-After': '2' };

interface OpcionesExportaciones {
  /** Lo que devuelve `GET /admin/exportaciones`, en orden: la última se repite. */
  listas?: Exportacion[][];
  /** Los estados sucesivos de la exportación que se pide: la última se repite. */
  seguimiento?: Exportacion[];
}

/**
 * Las exportaciones de un Admin: la lista, la solicitud (202 con la primera del seguimiento), su estado (cada
 * consulta avanza al siguiente) y la descarga. Devuelve los cuerpos de las solicitudes y las consultas recibidas.
 */
export function simularExportaciones({
  listas = [[exportacionDePrueba()]],
  seguimiento = [exportacionDePrueba({ estado: 'Pendiente', archivo: null })],
}: OpcionesExportaciones = {}) {
  const registro = {
    solicitudes: [] as { reporte: string; cuerpo: unknown }[],
    listas: 0,
    estados: 0,
  };
  const siguiente = <T>(lista: readonly T[], indice: number): T | undefined =>
    lista[Math.min(indice, lista.length - 1)];
  const conEncabezado = (exportacion: Exportacion | undefined) =>
    exportacion?.estado === 'Pendiente' || exportacion?.estado === 'Procesando' ? EN_CURSO : {};

  servidor.use(
    http.get('/api/v1/admin/exportaciones', () => {
      const datos = siguiente(listas, registro.listas++) ?? [];
      return HttpResponse.json({
        datos,
        paginacion: { pagina: 1, tamano: 20, total: datos.length, totalPaginas: 1 },
      });
    }),
    http.post('/api/v1/admin/reportes/:reporte/exportaciones', async ({ request, params }) => {
      registro.solicitudes.push({ reporte: String(params.reporte), cuerpo: await request.json() });
      const pedida = seguimiento[0];
      return HttpResponse.json({ datos: pedida }, { status: 202, headers: conEncabezado(pedida) });
    }),
    http.get('/api/v1/admin/exportaciones/:id', () => {
      registro.estados++;
      const actual = siguiente(seguimiento, registro.estados);
      return HttpResponse.json({ datos: actual }, { headers: conEncabezado(actual) });
    }),
    http.get('/api/v1/admin/exportaciones/:id/archivo', () =>
      HttpResponse.arrayBuffer(new Uint8Array([1, 2, 3]).buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="ventas.xlsx"; filename*=UTF-8''ventas-por-d%C3%ADa.xlsx`,
        },
      }),
    ),
  );
  return registro;
}
