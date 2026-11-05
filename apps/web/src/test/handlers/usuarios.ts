import { actualizarPerfilSchema } from '@shopcart/shared';
import { delay, http, HttpResponse } from 'msw';
import type { Respuesta, Rol } from '../../shared/api';
import { servidor } from '../servidor';
import { usuarioDePrueba } from '../sesion';

type Perfil = Respuesta<'/api/v1/usuarios/me', 'get'>['datos'];

export const perfilDePrueba = (rol: Rol = 'Cliente', cambios: Partial<Perfil> = {}): Perfil => ({
  ...usuarioDePrueba(rol),
  telefono: '55551234',
  activo: true,
  ...cambios,
});

const errorDelBackend = (
  status: number,
  error: { codigo: string; mensaje: string; detalles?: unknown },
) => HttpResponse.json({ error: { ...error, requestId: 'req-usuarios' } }, { status });

/** `GET /usuarios/me` con el perfil indicado; `demora` deja ver el estado de carga. */
export function simularPerfil(perfil: Perfil = perfilDePrueba(), demora = 0) {
  servidor.use(
    http.get('/api/v1/usuarios/me', async () => {
      await delay(demora);
      return HttpResponse.json({ datos: perfil });
    }),
  );
}

export function simularPerfilFallido(status: number, codigo: string, mensaje: string) {
  servidor.use(http.get('/api/v1/usuarios/me', () => errorDelBackend(status, { codigo, mensaje })));
}

/**
 * `PATCH /usuarios/me` que aplica los cambios como lo haría el SP y desde entonces responde el perfil nuevo
 * también en el `GET`; guarda los cuerpos recibidos.
 */
export function simularActualizarPerfil(perfil: Perfil = perfilDePrueba()) {
  const cuerpos: unknown[] = [];
  let actual = perfil;
  servidor.use(
    http.get('/api/v1/usuarios/me', () => HttpResponse.json({ datos: actual })),
    http.patch('/api/v1/usuarios/me', async ({ request }) => {
      const cambios = actualizarPerfilSchema.parse(await request.json());
      cuerpos.push(cambios);
      actual = { ...actual, ...cambios };
      return HttpResponse.json({ datos: actual });
    }),
  );
  return cuerpos;
}

/** `POST /usuarios/me/contrasena` que devuelve una sesión nueva; guarda los cuerpos recibidos. */
export function simularCambioDeContrasena(rol: Rol = 'Cliente') {
  const cuerpos: unknown[] = [];
  servidor.use(
    http.post('/api/v1/usuarios/me/contrasena', async ({ request }) => {
      cuerpos.push(await request.json());
      return HttpResponse.json({
        datos: { accessToken: 'token-tras-cambiar', expiraEn: 900, usuario: usuarioDePrueba(rol) },
      });
    }),
  );
  return cuerpos;
}

/** El 400 del backend cuando la contraseña actual no coincide (M1-H02). */
export function simularContrasenaActualIncorrecta() {
  const mensaje = 'La contraseña actual no es correcta.';
  servidor.use(
    http.post('/api/v1/usuarios/me/contrasena', () =>
      errorDelBackend(400, {
        codigo: 'PARAMETRO_INVALIDO',
        mensaje,
        detalles: { errores: [{ campo: 'body.contrasenaActual', mensaje }] },
      }),
    ),
  );
}
