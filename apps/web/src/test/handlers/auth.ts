import { http, HttpResponse } from 'msw';
import type { Respuesta, Rol } from '../../shared/api';
import { servidor } from '../servidor';
import { usuarioDePrueba } from '../sesion';

type RespuestaSesion = Respuesta<'/api/v1/auth/login', 'post'>;
type AvisosCarrito = NonNullable<RespuestaSesion['datos']['avisosCarrito']>;

const sesionDe = (rol: Rol, avisosCarrito?: AvisosCarrito): RespuestaSesion => ({
  datos: {
    accessToken: `token-de-${rol}`,
    expiraEn: 900,
    usuario: usuarioDePrueba(rol),
    ...(avisosCarrito ? { avisosCarrito } : {}),
  },
});

const errorDelBackend = (status: number, codigo: string, mensaje: string) =>
  HttpResponse.json({ error: { codigo, mensaje, requestId: 'req-auth' } }, { status });

/** `POST /auth/login` que inicia sesión con un usuario del rol indicado; guarda los cuerpos recibidos. */
export function simularLogin(rol: Rol = 'Cliente', avisosCarrito?: AvisosCarrito) {
  const cuerpos: unknown[] = [];
  servidor.use(
    http.post('/api/v1/auth/login', async ({ request }) => {
      cuerpos.push(await request.json());
      return HttpResponse.json(sesionDe(rol, avisosCarrito));
    }),
  );
  return cuerpos;
}

export function simularLoginFallido(status: number, codigo: string, mensaje: string) {
  servidor.use(http.post('/api/v1/auth/login', () => errorDelBackend(status, codigo, mensaje)));
}

/** `POST /auth/registro` que crea un Cliente; guarda los cuerpos recibidos. */
export function simularRegistro() {
  const cuerpos: unknown[] = [];
  servidor.use(
    http.post('/api/v1/auth/registro', async ({ request }) => {
      cuerpos.push(await request.json());
      return HttpResponse.json(sesionDe('Cliente'), { status: 201 });
    }),
  );
  return cuerpos;
}

export function simularRegistroFallido(status: number, codigo: string, mensaje: string) {
  servidor.use(http.post('/api/v1/auth/registro', () => errorDelBackend(status, codigo, mensaje)));
}
