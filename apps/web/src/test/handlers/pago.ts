import { delay, http, HttpResponse } from 'msw';
import type { Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

type Pedido = Respuesta<'/api/v1/checkout/sesion/pagos', 'post'>['datos'];

interface ErrorDePago {
  status: number;
  codigo: string;
  mensaje: string;
  detalles?: unknown;
}

/** Una respuesta del pago: el pedido (201), un error del backend o una falla de red. */
export type RespuestaDePago = Pedido | ErrorDePago | 'red';

export interface PagoRecibido {
  llave: string | null;
  cuerpo: unknown;
}

/**
 * `POST /checkout/sesion/pagos` con las respuestas indicadas, una por petición (la última se repite). Guarda la
 * llave y el cuerpo de cada una. Con `demora`, la respuesta tarda: deja ver el estado «pagando».
 */
export function simularPagos(respuestas: RespuestaDePago[], { demora = 0 } = {}) {
  const recibidos: PagoRecibido[] = [];
  servidor.use(
    http.post('/api/v1/checkout/sesion/pagos', async ({ request }) => {
      recibidos.push({
        llave: request.headers.get('idempotency-key'),
        cuerpo: await request.json(),
      });
      const respuesta = respuestas[Math.min(recibidos.length, respuestas.length) - 1] ?? 'red';
      await delay(demora);
      if (respuesta === 'red') return HttpResponse.error();
      if ('status' in respuesta) {
        const { status, ...error } = respuesta;
        return HttpResponse.json({ error: { ...error, requestId: 'req-pago' } }, { status });
      }
      return HttpResponse.json({ datos: respuesta }, { status: 201 });
    }),
  );
  return recibidos;
}

/** `DELETE /checkout/sesion` (204); cuenta las cancelaciones. */
export function simularCancelacionDePago() {
  const cancelaciones: number[] = [];
  servidor.use(
    http.delete('/api/v1/checkout/sesion', () => {
      cancelaciones.push(Date.now());
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return cancelaciones;
}
