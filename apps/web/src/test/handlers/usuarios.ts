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
  fechaCreacion: '2026-10-01T15:00:00.000Z',
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

// --- Usuarios del Admin (M10-H01).

type ListaUsuarios = Respuesta<'/api/v1/usuarios', 'get'>;
export type UsuarioAdminDePrueba = ListaUsuarios['datos'][number];

export const usuarioAdminDePrueba = (
  cambios: Partial<UsuarioAdminDePrueba> = {},
): UsuarioAdminDePrueba => ({
  idUsuario: 20,
  correo: 'operador@shopcart.gt',
  nombre: 'Olga Operadora',
  telefono: null,
  rol: 'Operador',
  activo: true,
  fechaCreacion: '2026-10-01T15:00:00.000Z',
  ...cambios,
});

interface ErrorDeUsuarios {
  status: number;
  codigo: string;
  mensaje: string;
}

/**
 * `GET /usuarios` con lo que haya en cada momento, el alta, la edición y los cambios de estado. Un error por
 * `"METODO ruta"` (`POST crear`, `PATCH editar`, `POST desactivar`) reemplaza la respuesta. Guarda las consultas y
 * lo recibido.
 */
export function simularUsuariosAdmin(
  iniciales: UsuarioAdminDePrueba[],
  errores: Partial<Record<string, ErrorDeUsuarios>> = {},
) {
  let usuarios = [...iniciales];
  const consultas: URLSearchParams[] = [];
  const recibidos: { metodo: string; ruta: string; cuerpo?: unknown }[] = [];
  const anotar = (metodo: string, ruta: string, cuerpo?: unknown) => {
    recibidos.push(cuerpo === undefined ? { metodo, ruta } : { metodo, ruta, cuerpo });
    const error = errores[`${metodo} ${ruta}`];
    return error && errorDelBackend(error.status, { codigo: error.codigo, mensaje: error.mensaje });
  };
  const cambiar = (id: number, cambios: Partial<UsuarioAdminDePrueba>) => {
    usuarios = usuarios.map((u) => (u.idUsuario === id ? { ...u, ...cambios } : u));
    return usuarios.find((u) => u.idUsuario === id);
  };
  servidor.use(
    http.get('/api/v1/usuarios', ({ request }) => {
      consultas.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        datos: usuarios,
        paginacion: { pagina: 1, tamano: 20, total: usuarios.length, totalPaginas: 1 },
      });
    }),
    http.post('/api/v1/usuarios', async ({ request }) => {
      const cuerpo = (await request.json()) as Partial<UsuarioAdminDePrueba>;
      const error = anotar('POST', 'crear', cuerpo);
      if (error) return error;
      const nuevo = usuarioAdminDePrueba({ ...cuerpo, idUsuario: 99 });
      usuarios = [nuevo, ...usuarios];
      return HttpResponse.json({ datos: nuevo }, { status: 201 });
    }),
    http.patch('/api/v1/usuarios/:id', async ({ request, params }) => {
      const cuerpo = (await request.json()) as Partial<UsuarioAdminDePrueba>;
      const error = anotar('PATCH', 'editar', cuerpo);
      if (error) return error;
      return HttpResponse.json({ datos: cambiar(Number(params.id), cuerpo) });
    }),
    http.post('/api/v1/usuarios/:id/:accion', ({ params }) => {
      const accion = String(params.accion);
      const error = anotar('POST', accion);
      if (error) return error;
      return HttpResponse.json({
        datos: cambiar(Number(params.id), { activo: accion === 'activar' }),
      });
    }),
  );
  return { consultas, recibidos };
}
