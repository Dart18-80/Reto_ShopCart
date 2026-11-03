import type { paths } from '@shopcart/contrato';
import createClient, { type Middleware } from 'openapi-fetch';
import { ErrorApi } from './ErrorApi';

/** Lo que el cliente necesita de la sesión (FE-05). */
export interface SesionDelCliente {
  token(): string | null;
  esperarRehidratacion(): Promise<void>;
  renovar(tokenRechazado: string | null): Promise<string | null>;
}

/** La copia de una petición, tomada antes de enviarla, con el token con que salió. */
export interface CopiaDePeticion {
  peticion: Request;
  token: string | null;
}

const PREFIJO_BEARER = 'Bearer ';
const PREFIJO_AUTH = '/api/v1/auth/';
const STATUS_NO_AUTENTICADO = 401;

// Las rutas de /auth no se renuevan ni esperan la rehidratación: un 401 ahí es la respuesta (credenciales, refresh
// rechazado), y la rehidratación misma es un POST /auth/refresh.
const esDeAuth = (schemaPath: string) => schemaPath.startsWith(PREFIJO_AUTH);

function tokenEnviado(peticion: Request): string | null {
  const autorizacion = peticion.headers.get('Authorization');
  return autorizacion?.startsWith(PREFIJO_BEARER)
    ? autorizacion.slice(PREFIJO_BEARER.length)
    : null;
}

function middlewareDeToken(sesion: SesionDelCliente): Middleware {
  return {
    async onRequest({ request, schemaPath }) {
      // 05 §5: nada sale antes de saber si hay sesión, así la primera consulta no provoca un 401.
      if (!esDeAuth(schemaPath)) await sesion.esperarRehidratacion();
      const token = sesion.token();
      if (token !== null) request.headers.set('Authorization', `${PREFIJO_BEARER}${token}`);
      return request;
    },
  };
}

async function reenviar(fetch: (peticion: Request) => Promise<Response>, peticion: Request) {
  try {
    return await fetch(peticion);
  } catch {
    // Al reintento no lo cubre el onError de openapi-fetch, que solo envuelve el primer envío.
    throw ErrorApi.deRed();
  }
}

/** FE-05: ante un 401 fuera de /auth, espera la renovación y reintenta una sola vez con el token nuevo. */
function middlewareDeRenovacion(
  sesion: SesionDelCliente,
  copias: Map<string, CopiaDePeticion>,
): Middleware {
  return {
    onRequest({ request, id }) {
      // El cuerpo de una petición se lee una sola vez: la copia para el reintento se toma antes de enviarla.
      copias.set(id, { peticion: request.clone(), token: tokenEnviado(request) });
    },
    async onResponse({ response, schemaPath, id, options }) {
      const copia = copias.get(id);
      copias.delete(id);
      if (response.status !== STATUS_NO_AUTENTICADO || esDeAuth(schemaPath)) return response;
      if (copia === undefined) return response;
      const tokenNuevo = await sesion.renovar(copia.token);
      if (tokenNuevo === null) return response;
      copia.peticion.headers.set('Authorization', `${PREFIJO_BEARER}${tokenNuevo}`);
      // El reintento no vuelve a pasar por los middlewares: un segundo 401 llega tal cual a middlewareDeErrores.
      return reenviar(options.fetch, copia.peticion);
    },
    onError({ id }) {
      copias.delete(id);
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

export function crearClienteApi(
  sesion: SesionDelCliente,
  copias = new Map<string, CopiaDePeticion>(),
) {
  const cliente = createClient<paths>({
    // Mismo origen que la SPA (A-03): las rutas del contrato ya empiezan con /api/v1 y las cookies son del
    // mismo origen. Se lee fetch en cada llamada para no fijar el global del momento en que se crea el cliente.
    baseUrl: globalThis.location.origin,
    fetch: (request) => globalThis.fetch(request),
  });
  // openapi-fetch corre los onRequest en el orden de registro y los onResponse y onError en el inverso: la copia
  // ya lleva el token, y la renovación ve el 401 antes de que middlewareDeErrores lo convierta en ErrorApi. La
  // renovación es el último onRequest: ninguno posterior puede cortar la petición y dejar su copia sin borrar.
  cliente.use(
    middlewareDeErrores,
    middlewareDeToken(sesion),
    middlewareDeRenovacion(sesion, copias),
  );
  return cliente;
}

export type ClienteApi = ReturnType<typeof crearClienteApi>;
