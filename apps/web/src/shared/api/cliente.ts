import type { paths } from '@shopcart/contrato';
import createClient, { type Middleware } from 'openapi-fetch';
import { ErrorApi } from './ErrorApi';

interface OpcionesCliente {
  /** El access token vigente, o null sin sesión. Lo da el módulo de sesión (F1-H04). */
  obtenerToken: () => string | null;
}

function middlewareDeToken(obtenerToken: () => string | null): Middleware {
  return {
    onRequest({ request }) {
      const token = obtenerToken();
      if (token !== null) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
  };
}

// Toda respuesta de error se convierte en ErrorApi aquí, así los hooks solo ven datos o ErrorApi (FE-13).
const middlewareDeErrores: Middleware = {
  async onResponse({ response }) {
    if (!response.ok) throw await ErrorApi.desdeRespuesta(response);
    return response;
  },
  onError() {
    return ErrorApi.deRed();
  },
};

export function crearClienteApi({ obtenerToken }: OpcionesCliente) {
  const cliente = createClient<paths>({
    // Mismo origen que la SPA (A-03): las rutas del contrato ya empiezan con /api/v1 y las cookies son del
    // mismo origen. Se lee fetch en cada llamada para no fijar el global del momento en que se crea el cliente.
    baseUrl: globalThis.location.origin,
    fetch: (request) => globalThis.fetch(request),
  });
  cliente.use(middlewareDeToken(obtenerToken), middlewareDeErrores);
  return cliente;
}
