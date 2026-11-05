import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { sesion, type Respuesta } from '../shared/api';
import { ANCHO_TELEFONO, simularPantalla } from '../test/pantalla';
import { renderizarRutas } from '../test/renderizar';
import { sesionDePrueba } from '../test/sesion';
import { servidor } from '../test/servidor';
import { crearRutas } from './router';

// Una página del backoffice que falla al renderizar, para ver el errorElement de su área.
vi.mock('../modules/bitacora/paginas/BitacoraPagina', () => ({
  BitacoraPagina: () => {
    throw new Error('La bitácora falló al renderizar');
  },
}));

type RespuestaRefresh = Respuesta<'/api/v1/auth/refresh', 'post'>;

const ENTRADAS_SOLO_ADMINISTRADOR = [
  'Dashboard',
  'Productos y precios',
  'Reembolsos',
  'Pagos en revisión',
  'Cupones',
  'Envíos',
  'Configuración',
  'Usuarios',
  'Bitácora',
  'Exportaciones',
];

const menuDelBackoffice = () => screen.getByRole('navigation', { name: 'Backoffice' });

describe('router: guardián por rol', () => {
  it('un Cliente que entra por URL al backoffice ve Sin permiso', async () => {
    renderizarRutas(crearRutas(), { ruta: '/backoffice/inventario', rol: 'Cliente' });

    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });

  it('un invitado que entra a una ruta de cuenta va a /ingresar con la ruta de regreso', async () => {
    const { router } = renderizarRutas(crearRutas(), { ruta: '/cuenta/perfil?pestana=datos' });

    expect(await screen.findByRole('heading', { name: 'Ingresa a tu cuenta' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(new URLSearchParams(router.state.location.search).get('volver')).toBe(
      '/cuenta/perfil?pestana=datos',
    );
  });

  it('un Operador no ve en el menú lo que es solo del Administrador', async () => {
    renderizarRutas(crearRutas(), { ruta: '/backoffice/pedidos', rol: 'Operador' });

    await screen.findByRole('heading', { name: 'Gestión de pedidos' });
    const menu = menuDelBackoffice();
    expect(within(menu).getByRole('link', { name: 'Pedidos' })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: 'Inventario' })).toBeInTheDocument();
    for (const etiqueta of ENTRADAS_SOLO_ADMINISTRADOR) {
      expect(within(menu).queryByRole('link', { name: etiqueta })).not.toBeInTheDocument();
    }
    expect(within(menu).getByRole('list', { name: 'Ventas' })).toBeInTheDocument();
    expect(within(menu).getByRole('list', { name: 'Catálogo' })).toBeInTheDocument();
    expect(within(menu).queryByRole('list', { name: 'Administración' })).not.toBeInTheDocument();
  });

  it('un Operador que entra por URL a una página del Administrador ve Sin permiso', async () => {
    renderizarRutas(crearRutas(), { ruta: '/backoffice/usuarios', rol: 'Operador' });

    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });

  it('el Administrador ve todo el menú del backoffice', async () => {
    renderizarRutas(crearRutas(), { ruta: '/backoffice/dashboard', rol: 'Administrador' });

    await screen.findByRole('heading', { name: 'Dashboard' });
    for (const etiqueta of ['Pedidos', 'Inventario', ...ENTRADAS_SOLO_ADMINISTRADOR]) {
      expect(within(menuDelBackoffice()).getByRole('link', { name: etiqueta })).toBeInTheDocument();
    }
  });

  it('/backoffice lleva a la primera página que el rol puede ver', async () => {
    const { router } = renderizarRutas(crearRutas(), { ruta: '/backoffice', rol: 'Operador' });

    await screen.findByRole('heading', { name: 'Gestión de pedidos' });
    expect(router.state.location.pathname).toBe('/backoffice/pedidos');
  });

  it('la tienda muestra a cada quien su encabezado: invitado, Cliente y personal', async () => {
    const invitado = renderizarRutas(crearRutas(), { ruta: '/' });
    await screen.findByRole('heading', { name: 'Catálogo' });
    expect(screen.getByRole('link', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Carrito' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Mis pedidos' })).not.toBeInTheDocument();
    invitado.unmount();

    const cliente = renderizarRutas(crearRutas(), { ruta: '/', rol: 'Cliente' });
    await screen.findByRole('heading', { name: 'Catálogo' });
    expect(screen.getByRole('link', { name: 'Mi cuenta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Carrito' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mis pedidos' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Backoffice' })).not.toBeInTheDocument();
    cliente.unmount();

    renderizarRutas(crearRutas(), { ruta: '/', rol: 'Administrador' });
    await screen.findByRole('heading', { name: 'Catálogo' });
    expect(screen.getByRole('link', { name: 'Backoffice' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Carrito' })).not.toBeInTheDocument();
  });

  it('el buscador del encabezado lleva al catálogo con el texto en la URL', async () => {
    const { usuario, router } = renderizarRutas(crearRutas(), { ruta: '/carrito' });
    await screen.findByRole('heading', { name: 'Carrito' });

    await usuario.type(
      screen.getByRole('searchbox', { name: 'Buscar productos' }),
      'camisa{Enter}',
    );

    expect(router.state.location.pathname).toBe('/');
    expect(new URLSearchParams(router.state.location.search).get('texto')).toBe('camisa');
  });

  it('cerrar sesión desde la barra lateral del backoffice lleva a ingresar', async () => {
    servidor.use(http.post('/api/v1/auth/logout', () => new HttpResponse(null, { status: 204 })));
    const { usuario, router } = renderizarRutas(crearRutas(), {
      ruta: '/backoffice/pedidos',
      rol: 'Operador',
    });
    await screen.findByRole('heading', { name: 'Gestión de pedidos' });
    expect(screen.getByText('Luis Operador')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByRole('heading', { name: 'Ingresa a tu cuenta' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
  });

  it('una ruta desconocida muestra No encontrado', async () => {
    renderizarRutas(crearRutas(), { ruta: '/esto/no/existe' });

    expect(
      await screen.findByRole('heading', { name: 'No encontramos esta página' }),
    ).toBeInTheDocument();
  });
});

describe('router: mientras se verifica la sesión', () => {
  function refreshControlado() {
    let responder: (respuesta: Response) => void = () => undefined;
    const respuesta = new Promise<Response>((resolver) => {
      responder = resolver;
    });
    servidor.use(http.post('/api/v1/auth/refresh', () => respuesta));
    return {
      responder: (r: Response) => {
        responder(r);
      },
    };
  }

  it('mientras rehidrata, una ruta protegida muestra la carga y la tienda se muestra', async () => {
    const refresh = refreshControlado();
    void sesion.rehidratar();
    const { unmount } = renderizarRutas(crearRutas(), { ruta: '/cuenta/perfil' });
    expect(await screen.findByRole('status')).toHaveTextContent('Verificando tu sesión');
    unmount();

    renderizarRutas(crearRutas(), { ruta: '/' });
    expect(await screen.findByRole('heading', { name: 'Catálogo' })).toBeInTheDocument();

    refresh.responder(
      HttpResponse.json<RespuestaRefresh>({
        datos: { ...sesionDePrueba('token-rehidratado'), expiraEn: 900 },
      }),
    );
    await sesion.esperarRehidratacion();
  });

  it('si la rehidratación falla por red, una ruta protegida muestra el error con Reintentar, no el login', async () => {
    let intentos = 0;
    servidor.use(
      http.post('/api/v1/auth/refresh', () => {
        intentos += 1;
        if (intentos === 1) return HttpResponse.error();
        return HttpResponse.json<RespuestaRefresh>({
          datos: { ...sesionDePrueba('token-rehidratado'), expiraEn: 900 },
        });
      }),
    );
    await sesion.rehidratar();
    const { usuario, router } = renderizarRutas(crearRutas(), { ruta: '/cuenta/perfil' });

    expect(await screen.findByText(/No pudimos conectar con la tienda/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/cuenta/perfil');
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument();
  });
});

describe('router: menú móvil del backoffice', () => {
  it('en el teléfono el menú se abre en un panel con solo lo del rol, y se cierra al elegir', async () => {
    simularPantalla(ANCHO_TELEFONO);
    const { usuario, router } = renderizarRutas(crearRutas(), {
      ruta: '/backoffice/pedidos',
      rol: 'Operador',
    });
    await screen.findByRole('heading', { name: 'Gestión de pedidos' });

    await usuario.click(screen.getByRole('button', { name: 'Abrir el menú' }));
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByRole('link', { name: 'Inventario' })).toBeInTheDocument();
    expect(within(panel).queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
    await usuario.click(within(panel).getByRole('link', { name: 'Inventario' }));

    expect(await screen.findByRole('heading', { name: 'Inventario' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/backoffice/inventario');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});

describe('router: la sesión se cierra con una ruta protegida abierta', () => {
  it('lleva a /ingresar con la ruta de regreso (05 §5)', async () => {
    const { router } = renderizarRutas(crearRutas(), { ruta: '/cuenta/perfil', rol: 'Cliente' });
    await screen.findByRole('heading', { name: 'Mi perfil' });

    // Como cuando otra pestaña cierra la sesión o el refresh se rechaza: la sesión pasa a invitado por fuera.
    act(() => {
      sesion.olvidar();
    });

    expect(await screen.findByRole('heading', { name: 'Ingresa a tu cuenta' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ingresar');
    expect(new URLSearchParams(router.state.location.search).get('volver')).toBe('/cuenta/perfil');
  });
});

describe('router: errores por área', () => {
  it('un error al renderizar una página del backoffice muestra el error del área y la tienda sigue funcionando', async () => {
    const { usuario } = renderizarRutas(crearRutas(), {
      ruta: '/backoffice/bitacora',
      rol: 'Administrador',
    });

    expect(
      await screen.findByRole('heading', { name: 'Algo falló en el backoffice' }),
    ).toBeInTheDocument();
    await usuario.click(screen.getByRole('link', { name: 'Ir a la tienda' }));

    expect(await screen.findByRole('heading', { name: 'Catálogo' })).toBeInTheDocument();
  });
});
