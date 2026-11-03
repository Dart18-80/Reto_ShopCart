import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { crearCanalesEnMemoria, sesionDePrueba } from '../../test/sesion';
import { servidor } from '../../test/servidor';
import type { CopiaDePeticion } from './cliente';
import { crearConexion } from './conexion';
import { crearQueryClient } from './consultas';
import { ErrorApi } from './ErrorApi';
import { crearBloqueoDeLaPestana } from './sesion/navegador';
import type { Respuesta } from './tipos';

const REFRESH = '/api/v1/auth/refresh';
const CARRITO = '/api/v1/carrito';
const TOKEN_NUEVO = 'token-nuevo';

type RespuestaRefresh = Respuesta<'/api/v1/auth/refresh', 'post'>;
type RespuestaCarrito = Respuesta<'/api/v1/carrito', 'get'>;

const CARRITO_VACIO: RespuestaCarrito = {
  datos: {
    lineas: [],
    resumen: {
      lineas: 0,
      unidades: 0,
      subtotal: '0.00',
      descuento: '0.00',
      total: '0.00',
      puedePagar: false,
      cupon: null,
      cuponRetirado: null,
      envioGratis: null,
    },
  },
};

const errorDelBackend = (status: number, codigo: string) =>
  HttpResponse.json({ error: { codigo, mensaje: codigo, requestId: 'req-1' } }, { status });

/** Pestañas del mismo navegador, cada una con su sesión y su cliente `api` (el cableado real de la aplicación). */
function crearNavegador() {
  const bloqueo = crearBloqueoDeLaPestana();
  const canal = crearCanalesEnMemoria();
  return (copias = new Map<string, CopiaDePeticion>()) =>
    crearConexion({ bloqueo, canal: canal(), copias });
}

/** El refresh del backend simulado: cuenta las llamadas y entrega `TOKEN_NUEVO`, o el error indicado. */
function simularRefresh(error?: { status: number; codigo: string }) {
  const llamadas = { total: 0 };
  servidor.use(
    http.post(REFRESH, () => {
      llamadas.total += 1;
      if (error) return errorDelBackend(error.status, error.codigo);
      return HttpResponse.json<RespuestaRefresh>({
        datos: { ...sesionDePrueba(TOKEN_NUEVO), expiraEn: 900 },
      });
    }),
  );
  return llamadas;
}

/** El carrito simulado: 401 con cualquier token que no sea `tokenValido`; guarda cada Authorization recibido. */
function simularCarrito(tokenValido = TOKEN_NUEVO) {
  const autorizaciones: (string | null)[] = [];
  servidor.use(
    http.get(CARRITO, ({ request }) => {
      const autorizacion = request.headers.get('Authorization');
      autorizaciones.push(autorizacion);
      if (autorizacion !== `Bearer ${tokenValido}`) return errorDelBackend(401, 'NO_AUTENTICADO');
      return HttpResponse.json(CARRITO_VACIO);
    }),
  );
  return autorizaciones;
}

async function errorDe(llamada: Promise<unknown>): Promise<ErrorApi> {
  try {
    await llamada;
  } catch (error) {
    if (error instanceof ErrorApi) return error;
    throw error;
  }
  throw new Error('La llamada debía lanzar un ErrorApi');
}

const entregarMensajes = () => new Promise((resolver) => setTimeout(resolver, 0));

describe('cliente api con sesión: renovación ante un 401', () => {
  it('cinco peticiones que reciben 401 a la vez hacen un solo refresh y las cinco se completan', async () => {
    const refresh = simularRefresh();
    simularCarrito();
    const { api, sesion } = crearNavegador()();
    sesion.establecer(sesionDePrueba('token-vencido'));

    const respuestas = await Promise.all([1, 2, 3, 4, 5].map(() => api.GET(CARRITO)));

    expect(refresh.total).toBe(1);
    expect(respuestas.map(({ response }) => response.status)).toEqual([200, 200, 200, 200, 200]);
  });

  it('el reintento sale con el token nuevo', async () => {
    simularRefresh();
    const autorizaciones = simularCarrito();
    const { api, sesion } = crearNavegador()();
    sesion.establecer(sesionDePrueba('token-vencido'));

    await api.GET(CARRITO);

    expect(autorizaciones).toEqual(['Bearer token-vencido', `Bearer ${TOKEN_NUEVO}`]);
  });

  it('el reintento lleva el mismo cuerpo que la petición original', async () => {
    simularRefresh();
    const cuerpos: unknown[] = [];
    servidor.use(
      http.post('/api/v1/carrito/lineas', async ({ request }) => {
        cuerpos.push(await request.json());
        if (request.headers.get('Authorization') !== `Bearer ${TOKEN_NUEVO}`) {
          return errorDelBackend(401, 'NO_AUTENTICADO');
        }
        return HttpResponse.json(CARRITO_VACIO);
      }),
    );
    const { api, sesion } = crearNavegador()();
    sesion.establecer(sesionDePrueba('token-vencido'));
    const cuerpo = { idVariante: 5, cantidad: 2 };

    await api.POST('/api/v1/carrito/lineas', { body: cuerpo });

    expect(cuerpos).toEqual([cuerpo, cuerpo]);
  });

  it('si el reintento vuelve a recibir 401, el llamador recibe ErrorApi 401 y no hay un segundo refresh', async () => {
    const refresh = simularRefresh();
    simularCarrito('token-que-nunca-llega');
    const { api, sesion } = crearNavegador()();
    sesion.establecer(sesionDePrueba('token-vencido'));

    const error = await errorDe(api.GET(CARRITO));

    expect(error).toMatchObject({ status: 401, codigo: 'NO_AUTENTICADO' });
    expect(refresh.total).toBe(1);
  });

  it('si el usuario cambió mientras la petición estaba en vuelo, no se reintenta con el token del otro', async () => {
    const refresh = simularRefresh();
    const autorizaciones: (string | null)[] = [];
    let responder: () => void = () => undefined;
    servidor.use(
      http.get(CARRITO, ({ request }) => {
        autorizaciones.push(request.headers.get('Authorization'));
        return new Promise<Response>((resolver) => {
          responder = () => {
            resolver(errorDelBackend(401, 'NO_AUTENTICADO'));
          };
        });
      }),
    );
    const { api, sesion } = crearNavegador()();
    sesion.establecer(sesionDePrueba('token-de-ana', 'Cliente'));

    const peticion = errorDe(api.GET(CARRITO));
    await waitFor(() => {
      expect(autorizaciones).toHaveLength(1);
    });
    sesion.establecer(sesionDePrueba('token-de-luis', 'Operador'));
    responder();

    expect((await peticion).status).toBe(401);
    expect(autorizaciones).toEqual(['Bearer token-de-ana']);
    expect(refresh.total).toBe(0);
  });

  it('una petición cancelada no se muestra como falla de red', async () => {
    servidor.use(http.get(CARRITO, () => new Promise<Response>(() => undefined)));
    const { api } = crearNavegador()();
    const cancelacion = new AbortController();

    const peticion = api.GET(CARRITO, { signal: cancelacion.signal });
    cancelacion.abort();

    await expect(peticion).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('un invitado que recibe 401 no dispara el refresh', async () => {
    const refresh = simularRefresh();
    simularCarrito();
    const { api } = crearNavegador()();

    const error = await errorDe(api.GET(CARRITO));

    expect(error.status).toBe(401);
    expect(refresh.total).toBe(0);
  });

  it('un 401 de /auth/login llega como ErrorApi y no dispara renovación', async () => {
    const refresh = simularRefresh();
    servidor.use(
      http.post('/api/v1/auth/login', () => errorDelBackend(401, 'CREDENCIALES_INVALIDAS')),
    );
    const { api, sesion } = crearNavegador()();
    sesion.establecer(sesionDePrueba('token-de-otra-sesion'));

    const error = await errorDe(
      api.POST('/api/v1/auth/login', {
        body: { correo: 'ana@prueba.gt', contrasena: 'incorrecta' },
      }),
    );

    expect(error).toMatchObject({ status: 401, codigo: 'CREDENCIALES_INVALIDAS' });
    expect(refresh.total).toBe(0);
  });

  it('una falla de red en el reintento llega como ErrorApi de red', async () => {
    simularRefresh();
    servidor.use(
      http.get(CARRITO, ({ request }) =>
        request.headers.get('Authorization') === `Bearer ${TOKEN_NUEVO}`
          ? HttpResponse.error()
          : errorDelBackend(401, 'NO_AUTENTICADO'),
      ),
    );
    const { api, sesion } = crearNavegador()();
    sesion.establecer(sesionDePrueba('token-vencido'));

    const error = await errorDe(api.GET(CARRITO));

    expect(error.codigo).toBe('RED');
  });
});

describe('cliente api con sesión: copias de las peticiones', () => {
  it('la copia de cada petición se borra al terminar: con éxito, con renovación y con falla de red', async () => {
    simularRefresh();
    simularCarrito();
    servidor.use(http.get('/api/v1/direcciones', () => HttpResponse.error()));
    const copias = new Map<string, CopiaDePeticion>();
    const { api, sesion } = crearNavegador()(copias);
    sesion.establecer(sesionDePrueba('token-vencido'));

    await api.GET(CARRITO);
    await api.GET(CARRITO);
    await errorDe(api.GET('/api/v1/direcciones'));

    expect(copias.size).toBe(0);
  });
});

describe('cliente api con sesión: refresh rechazado', () => {
  it.each(['REFRESH_REUTILIZADO', 'USUARIO_INACTIVO', 'NO_AUTENTICADO'])(
    'con %s la sesión queda cerrada en todas las pestañas y la caché vacía',
    async (codigo) => {
      simularRefresh({ status: 401, codigo });
      simularCarrito();
      const pestana = crearNavegador();
      const a = pestana();
      const b = pestana();
      const cachesPorPestana = [a, b].map(({ sesion }) => {
        const queryClient = crearQueryClient();
        queryClient.setQueryData(['pedidos', 'lista'], { datos: ['pedido de Ana'] });
        sesion.alCambiarUsuario(() => {
          queryClient.clear();
        });
        return queryClient;
      });
      a.sesion.establecer(sesionDePrueba('token-vencido'));
      await entregarMensajes();

      const error = await errorDe(a.api.GET(CARRITO));
      await entregarMensajes();

      expect(error.status).toBe(401);
      expect(a.sesion.estado()).toEqual({ tipo: 'invitado' });
      expect(b.sesion.estado()).toEqual({ tipo: 'invitado' });
      for (const queryClient of cachesPorPestana) {
        expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
      }
    },
  );
});

describe('cliente api con sesión: rehidratación', () => {
  function ConsultaAlMontar({ consultar }: { consultar: () => Promise<unknown> }) {
    const consulta = useQuery({ queryKey: ['carrito'], queryFn: consultar });
    return <p>{consulta.status}</p>;
  }

  it('una consulta disparada al montar espera la rehidratación: sale con el token y sin ningún 401', async () => {
    const refresh = simularRefresh();
    const autorizaciones = simularCarrito();
    const { api, sesion } = crearNavegador()();

    void sesion.rehidratar();
    render(
      <QueryClientProvider client={crearQueryClient()}>
        <ConsultaAlMontar consultar={() => api.GET(CARRITO)} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText('success')).toBeInTheDocument();
    expect(refresh.total).toBe(1);
    expect(autorizaciones).toEqual([`Bearer ${TOKEN_NUEVO}`]);
  });
});

describe('cliente api con sesión: el token nunca se guarda en el navegador', () => {
  it('después de iniciar y renovar sesión, localStorage y sessionStorage no contienen el token', async () => {
    simularRefresh();
    simularCarrito();
    const { api, sesion } = crearNavegador()();

    sesion.establecer(sesionDePrueba('token-de-inicio'));
    await api.GET(CARRITO);

    expect(sesion.token()).toBe(TOKEN_NUEVO);
    for (const almacen of [localStorage, sessionStorage]) {
      const contenido = Object.keys(almacen).flatMap((clave) => [clave, almacen.getItem(clave)]);
      expect(contenido.join(' ')).not.toContain('token-de-inicio');
      expect(contenido.join(' ')).not.toContain(TOKEN_NUEVO);
    }
  });
});
