import { http, HttpResponse } from 'msw';
import type { Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

type ListaReembolsos = Respuesta<'/api/v1/admin/reembolsos', 'get'>;
export type ReembolsoDePrueba = ListaReembolsos['datos'][number];
type ListaPagos = Respuesta<'/api/v1/admin/pagos/en-revision', 'get'>;
export type PagoEnRevisionDePrueba = ListaPagos['datos'][number];

interface ErrorSimulado {
  status: number;
  codigo: string;
  mensaje: string;
}

const responderError = ({ status, ...error }: ErrorSimulado) =>
  HttpResponse.json({ error: { ...error, requestId: 'req-rev' } }, { status });

const pagina = <T>(datos: T[]) => ({
  datos,
  paginacion: { pagina: 1, tamano: 20, total: datos.length, totalPaginas: 1 },
});

export const reembolsoDePrueba = (cambios: Partial<ReembolsoDePrueba> = {}): ReembolsoDePrueba => ({
  idReembolso: 12,
  idPedido: 41,
  numeroPedido: 'SC-000041',
  idIntentoPago: 900,
  idDevolucion: null,
  origen: 'Cancelacion',
  monto: '533.00',
  estado: 'Fallido',
  intentos: 3,
  ultimoError: 'La pasarela no respondió.',
  idTransaccionReembolso: null,
  fechaProximoIntento: null,
  fechaCompletado: null,
  fechaCreacion: '2026-11-05T18:05:00.000Z',
  motivoResolucion: null,
  referenciaResolucion: null,
  fechaResolucion: null,
  ...cambios,
});

/**
 * `GET /admin/reembolsos` con la lista que tenga en cada momento; `reemplazar` cambia lo que responden las
 * lecturas siguientes (el reintento lo completó). Guarda la consulta de cada petición.
 */
export function simularReembolsos(iniciales: ReembolsoDePrueba[]) {
  let actuales = iniciales;
  const consultas: URLSearchParams[] = [];
  servidor.use(
    http.get('/api/v1/admin/reembolsos', ({ request }) => {
      consultas.push(new URL(request.url).searchParams);
      return HttpResponse.json(pagina(actuales));
    }),
  );
  return {
    consultas,
    reemplazar: (reembolsos: ReembolsoDePrueba[]) => {
      actuales = reembolsos;
    },
  };
}

type EstadoReembolso = ReembolsoDePrueba['estado'];

/** `POST /admin/reembolsos/{id}/reintentar`: el estado en que quedó, o el error indicado. */
export function simularReintento(respuesta: EstadoReembolso | ErrorSimulado) {
  const ids: string[] = [];
  servidor.use(
    http.post('/api/v1/admin/reembolsos/:id/reintentar', ({ params }) => {
      ids.push(String(params.id));
      return typeof respuesta === 'string'
        ? HttpResponse.json({ datos: { idReembolso: Number(params.id), estado: respuesta } })
        : responderError(respuesta);
    }),
  );
  return ids;
}

/** `POST /admin/reembolsos/{id}/resolver`: el reembolso resuelto, o el error indicado. Guarda cada cuerpo. */
export function simularResolverReembolso(respuesta: ReembolsoDePrueba | ErrorSimulado) {
  const recibidos: unknown[] = [];
  servidor.use(
    http.post('/api/v1/admin/reembolsos/:id/resolver', async ({ request }) => {
      recibidos.push(await request.json());
      return 'status' in respuesta
        ? responderError(respuesta)
        : HttpResponse.json({ datos: respuesta });
    }),
  );
  return recibidos;
}

export const pagoEnRevisionDePrueba = (
  cambios: Partial<PagoEnRevisionDePrueba> = {},
): PagoEnRevisionDePrueba => ({
  idIntentoPago: 900,
  idPedido: 41,
  numeroPedido: 'SC-000041',
  cliente: { idUsuario: 7, nombre: 'María López', correo: 'maria@correo.gt' },
  monto: '533.00',
  idTransaccion: 'tx-900',
  tarjeta: { marca: 'Visa', ultimosDigitos: '4242' },
  causa: 'AutorizacionInexistente',
  fecha: '2026-11-05T18:05:00.000Z',
  ...cambios,
});

export function simularPagosEnRevision(pagos: PagoEnRevisionDePrueba[]) {
  servidor.use(http.get('/api/v1/admin/pagos/en-revision', () => HttpResponse.json(pagina(pagos))));
}

type Resolucion = Respuesta<'/api/v1/admin/pagos/{id}/resolver', 'post'>['datos']['resolucion'];

/** `POST /admin/pagos/{id}/resolver`: el pago resuelto (sin pedido en la respuesta), o el error indicado. */
export function simularResolverPago(
  respuesta:
    | { resolucion: Resolucion; reembolso: { idReembolso: number; estado: EstadoReembolso } | null }
    | ErrorSimulado,
) {
  const recibidos: unknown[] = [];
  servidor.use(
    http.post('/api/v1/admin/pagos/:id/resolver', async ({ request, params }) => {
      recibidos.push(await request.json());
      if ('status' in respuesta) return responderError(respuesta);
      return HttpResponse.json({
        datos: {
          idIntentoPago: Number(params.id),
          estado: respuesta.resolucion === 'CobroVerificado' ? 'Capturado' : 'Anulado',
          resolucion: respuesta.resolucion,
          motivo: 'Revisado',
          fechaResolucion: '2026-11-06T10:00:00.000Z',
          pedido: null,
          reembolso: respuesta.reembolso,
        },
      });
    }),
  );
  return recibidos;
}
