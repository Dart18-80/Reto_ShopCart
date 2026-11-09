import { http, HttpResponse } from 'msw';
import type { Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

export type MetodoEnvioAdmin = Respuesta<'/api/v1/admin/envios/metodos', 'get'>['datos'][number];
export type Configuracion = Respuesta<'/api/v1/admin/configuracion', 'get'>['datos'];

interface ErrorSimulado {
  status: number;
  codigo: string;
  mensaje: string;
}

const responderError = ({ status, ...error }: ErrorSimulado) =>
  HttpResponse.json({ error: { ...error, requestId: 'req-adm' } }, { status });

export const metodoAdminDePrueba = (cambios: Partial<MetodoEnvioAdmin> = {}): MetodoEnvioAdmin => ({
  idMetodoEnvio: 1,
  codigo: 'Estandar',
  nombre: 'Estándar',
  costo: '35.00',
  diasMin: 3,
  diasMax: 5,
  activo: true,
  ...cambios,
});

/**
 * `GET /admin/envios/metodos` con lo que haya en cada momento y `PUT .../{id}`, que lo guarda o responde el error
 * indicado. Devuelve los cuerpos recibidos.
 */
export function simularMetodosAdmin(iniciales: MetodoEnvioAdmin[], error?: ErrorSimulado) {
  let metodos = [...iniciales];
  const recibidos: unknown[] = [];
  servidor.use(
    http.get('/api/v1/admin/envios/metodos', () => HttpResponse.json({ datos: metodos })),
    http.put('/api/v1/admin/envios/metodos/:id', async ({ request, params }) => {
      const cuerpo = (await request.json()) as Partial<MetodoEnvioAdmin>;
      recibidos.push(cuerpo);
      if (error) return responderError(error);
      const id = Number(params.id);
      metodos = metodos.map((m) => (m.idMetodoEnvio === id ? { ...m, ...cuerpo } : m));
      return HttpResponse.json({ datos: metodos.find((m) => m.idMetodoEnvio === id) });
    }),
  );
  return recibidos;
}

export const configuracionDePrueba = (cambios: Partial<Configuracion> = {}): Configuracion => ({
  diasGarantiaPrecio: 3,
  minutosReserva: 15,
  horasCarritoAbandonado: 24,
  diasExpiracionCarritoInvitado: 30,
  umbralUltimasUnidades: 5,
  montoEnvioGratis: '500.00',
  maxIntentosPagoRechazados: 3,
  diasPlazoDevolucion: 30,
  maxLineasCarrito: 50,
  fechaActualizacion: '2026-11-05T18:05:00.000Z',
  ...cambios,
});

/**
 * `GET` y `PATCH /admin/configuracion`: el PATCH mezcla lo recibido, o responde el error indicado. Devuelve los
 * cuerpos recibidos y cuántas veces se leyó.
 */
export function simularConfiguracion(inicial: Configuracion, error?: ErrorSimulado) {
  let actual = inicial;
  const recibidos: unknown[] = [];
  const lecturas = { total: 0 };
  servidor.use(
    http.get('/api/v1/admin/configuracion', () => {
      lecturas.total += 1;
      return HttpResponse.json({ datos: actual });
    }),
    http.patch('/api/v1/admin/configuracion', async ({ request }) => {
      const cuerpo = (await request.json()) as Partial<Configuracion>;
      recibidos.push(cuerpo);
      if (error) return responderError(error);
      actual = { ...actual, ...cuerpo, fechaActualizacion: '2026-11-08T10:00:00.000Z' };
      return HttpResponse.json({ datos: actual });
    }),
  );
  return { recibidos, lecturas };
}
