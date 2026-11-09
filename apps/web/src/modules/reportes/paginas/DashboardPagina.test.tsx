import { act, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearRutas } from '../../../app/router';
import { exportacionDePrueba, simularExportaciones } from '../../../test/handlers/exportaciones';
import { simularDashboard } from '../../../test/handlers/reportes';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = (
  ruta = '/backoffice/dashboard',
  rol: 'Administrador' | 'Operador' = 'Administrador',
) => renderizarRutas(crearRutas(), { ruta, rol });

const panel = async (titulo: string) => within(await screen.findByRole('region', { name: titulo }));

const ultima = (consultas: URLSearchParams[]) => Object.fromEntries(consultas.at(-1) ?? []);

// jsdom no calcula tamaños: sin esto, ResponsiveContainer mide 0 × 0 y Recharts no dibuja ninguna barra.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({ width: 800, height: 300 }),
  );
});
afterEach(() => {
  vi.restoreAllMocks();
});

const barras = (grafica: HTMLElement, tono: 'valor' | 'negativo') =>
  grafica.querySelectorAll(`.recharts-rectangle[fill="var(--color-${tono})"]`);

describe('DashboardPagina (M11-H01)', () => {
  it('sin rango en la URL, los reportes usan el del backend y el resumen dice cuál fue', async () => {
    const consultas = simularDashboard();
    abrir();

    const resumen = await panel('Resumen del periodo');
    expect(await resumen.findByText('Del 10 oct 2026 al 8 nov 2026')).toBeInTheDocument();
    expect(resumen.getByText('Q12,500.50')).toBeInTheDocument();
    expect(resumen.getByText('42')).toBeInTheDocument();
    expect(resumen.getByText('Q2,150.00')).toBeInTheDocument();
    expect(ultima(consultas.resumen)).toEqual({});
  });

  it('cambiar la agrupación cambia la URL y la consulta de ventas, sin mover la página de los carritos', async () => {
    const consultas = simularDashboard();
    const { usuario, router } = abrir('/backoffice/dashboard?pagina=2');

    const ventas = await panel('Ventas por periodo');
    await usuario.selectOptions(ventas.getByLabelText('Agrupar por'), 'Semana');

    await waitFor(() => {
      expect(ultima(consultas.ventas)).toEqual({ agrupacion: 'semana' });
    });
    expect(router.state.location.search).toContain('agrupacion=semana');
    expect(router.state.location.search).toContain('pagina=2');
  });

  it('cambiar el rango cambia la URL y lo pide a todos los reportes', async () => {
    const consultas = simularDashboard();
    const { usuario, router } = abrir();

    await screen.findByText('Del 10 oct 2026 al 8 nov 2026');
    await usuario.type(screen.getByLabelText('Desde'), '2026-11-01');

    await waitFor(() => {
      expect(ultima(consultas.resumen)).toEqual({ desde: '2026-11-01' });
    });
    for (const reporte of ['ventas', 'categorias', 'top', 'carritos'] as const) {
      expect(ultima(consultas[reporte])).toMatchObject({ desde: '2026-11-01' });
    }
    expect(router.state.location.search).toContain('desde=2026-11-01');
  });

  it('una gráfica que falla muestra su error con Reintentar y las demás siguen', async () => {
    simularDashboard({ fallan: ['categorias'] });
    abrir();

    const categorias = await panel('Ventas por categoría');
    expect(await categorias.findByText('No pudimos cargar el reporte.')).toBeInTheDocument();
    expect(categorias.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();

    const top = await panel('Top 10 productos');
    await top.findByRole('figure', { name: 'Los 10 productos más vendidos por unidades' });
    expect(await screen.findByText('Q12,500.50')).toBeInTheDocument();
    expect(await screen.findByText('Carla Cliente')).toBeInTheDocument();
  });

  it('«Ver como tabla» muestra los mismos datos; un periodo negativo dice «neto con devoluciones»', async () => {
    simularDashboard();
    const { usuario } = abrir();

    const ventas = await panel('Ventas por periodo');
    await ventas.findByRole('figure');
    await usuario.click(ventas.getByRole('button', { name: 'Ver como tabla' }));

    const tabla = ventas.getByRole('table', { name: 'Ventas por periodo' });
    const negativo = within(within(tabla).getByText('7 nov 2026').closest('tr') ?? tabla);
    expect(negativo.getByText('-Q120.00')).toBeInTheDocument();
    expect(negativo.getByText('(neto con devoluciones)')).toBeInTheDocument();
    expect(within(tabla).getByText('Q1,500.50')).toBeInTheDocument();
    expect(ventas.getByRole('button', { name: 'Ver como gráfica' })).toBeInTheDocument();
  });

  it('la barra negativa lleva su propio tono y la gráfica la nombra con texto (N-11)', async () => {
    simularDashboard();
    abrir();

    const ventas = await panel('Ventas por periodo');
    const grafica = await ventas.findByRole('figure', { name: 'Ventas por día en quetzales' });
    await waitFor(() => {
      expect(barras(grafica, 'negativo')).toHaveLength(1);
    });
    expect(barras(grafica, 'valor')).toHaveLength(1);
    expect(ventas.getByText('Neto con devoluciones: 7 nov 2026.')).toBeInTheDocument();
  });

  it('en pedidos no hay barras negativas que nombrar', async () => {
    simularDashboard();
    abrir('/backoffice/dashboard?metrica=pedidos');

    const ventas = await panel('Ventas por periodo');
    await ventas.findByRole('figure', { name: 'Ventas por día en pedidos' });
    expect(ventas.queryByText(/Neto con devoluciones/)).not.toBeInTheDocument();
  });

  it('sin ventas en el periodo, cada gráfica lo dice', async () => {
    simularDashboard({ ventas: [] });
    abrir();

    const ventas = await panel('Ventas por periodo');
    expect(await ventas.findByText('Sin ventas en este periodo')).toBeInTheDocument();
  });

  it('los carritos abandonados: cliente o invitado, actividad y monto, ordenables por el servidor', async () => {
    const consultas = simularDashboard();
    const { usuario, router } = abrir();

    const carritos = await panel('Carritos abandonados');
    const fila = within(
      (await carritos.findByText('Carla Cliente')).closest('tr') ?? document.body,
    );
    expect(fila.getByText('Q450.00')).toBeInTheDocument();
    expect(fila.getByText('6 nov 2026, 10:00')).toBeInTheDocument();

    await usuario.click(carritos.getByRole('button', { name: /Última actividad/ }));

    await waitFor(() => {
      expect(ultima(consultas.carritos)).toMatchObject({ orden: 'inactividad' });
    });
    expect(router.state.location.search).toContain('orden=inactividad');
  });

  it('tiempo real (M11-H02): conectado dice «En vivo»; un cambio de ventas vuelve a pedir solo sus reportes', async () => {
    const consultas = simularDashboard();
    abrir();

    expect(await screen.findByText('En vivo')).toBeInTheDocument();
    await screen.findByText('Carla Cliente');
    const antes = {
      resumen: consultas.resumen.length,
      ventas: consultas.ventas.length,
      categorias: consultas.categorias.length,
      top: consultas.top.length,
      carritos: consultas.carritos.length,
    };

    consultas.eventos.cambio('ventas', 2);

    await waitFor(() => {
      expect(consultas.resumen.length).toBe(antes.resumen + 1);
    });
    await waitFor(() => {
      expect(consultas.top.length).toBe(antes.top + 1);
    });
    expect(consultas.ventas.length).toBe(antes.ventas + 1);
    expect(consultas.categorias.length).toBe(antes.categorias + 1);
    expect(consultas.carritos.length).toBe(antes.carritos);
  });

  it('tiempo real (M11-H02): un cambio de carritos vuelve a pedir los carritos y el resumen, no las ventas', async () => {
    const consultas = simularDashboard();
    abrir();

    await screen.findByText('En vivo');
    await screen.findByText('Carla Cliente');
    const ventasAntes = consultas.ventas.length;
    const carritosAntes = consultas.carritos.length;
    const resumenAntes = consultas.resumen.length;

    consultas.eventos.cambio('carritos', 2);

    await waitFor(() => {
      expect(consultas.carritos.length).toBe(carritosAntes + 1);
    });
    expect(consultas.resumen.length).toBe(resumenAntes + 1);
    expect(consultas.ventas.length).toBe(ventasAntes);
  });

  it('tiempo real (M11-H02): con la pestaña oculta queda «En pausa»; al volver reconecta con Last-Event-ID', async () => {
    const consultas = simularDashboard();
    abrir();
    await screen.findByText('En vivo');
    let oculta = true;
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => oculta);

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await screen.findByText('En pausa')).toBeInTheDocument();

    oculta = false;
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(await screen.findByText('En vivo')).toBeInTheDocument();
    expect(consultas.eventos.ultimosIds).toEqual([null, 'ventas1.carritos1']);
  });

  it('exportar (M11-H03): manda los filtros de la pantalla y sigue la exportación hasta que se puede descargar', async () => {
    simularDashboard();
    const registro = simularExportaciones({
      seguimiento: [
        exportacionDePrueba({ estado: 'Pendiente', archivo: null }),
        exportacionDePrueba(),
      ],
    });
    const { usuario } = abrir('/backoffice/dashboard?desde=2026-11-01&agrupacion=semana&pagina=2');

    const ventas = await panel('Ventas por periodo');
    await usuario.click(await ventas.findByRole('button', { name: 'Exportar Ventas por periodo' }));
    const dialogo = within(await screen.findByRole('dialog'));
    await usuario.selectOptions(dialogo.getByLabelText('Formato'), 'PDF');
    await usuario.click(dialogo.getByRole('button', { name: 'Exportar' }));

    expect(await dialogo.findByText('En cola')).toBeInTheDocument();
    expect(registro.solicitudes).toEqual([
      {
        reporte: 'ventas',
        cuerpo: { formato: 'pdf', filtros: { desde: '2026-11-01', agrupacion: 'semana' } },
      },
    ]);
    // El backend pide volver a consultar en 2 s (Retry-After).
    expect(
      await dialogo.findByText('Lista para descargar', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(dialogo.getByRole('button', { name: 'Descargar' })).toBeInTheDocument();
    expect(dialogo.getByRole('link', { name: 'Ver mis exportaciones' })).toHaveAttribute(
      'href',
      '/backoffice/exportaciones',
    );
  });

  it('exportar (M11-H03): los carritos se exportan con el rango, sin la página ni el orden de la tabla', async () => {
    simularDashboard();
    const registro = simularExportaciones();
    const { usuario } = abrir('/backoffice/dashboard?hasta=2026-11-08&pagina=2&orden=inactividad');

    const carritos = await panel('Carritos abandonados');
    await usuario.click(carritos.getByRole('button', { name: 'Exportar Carritos abandonados' }));
    const dialogo = within(await screen.findByRole('dialog'));
    await usuario.click(dialogo.getByRole('button', { name: 'Exportar' }));

    await dialogo.findByText('En cola');
    expect(registro.solicitudes).toEqual([
      {
        reporte: 'carritos-abandonados',
        cuerpo: { formato: 'xlsx', filtros: { hasta: '2026-11-08' } },
      },
    ]);
  });

  it('un Operador ve «Sin permiso»', async () => {
    abrir('/backoffice/dashboard', 'Operador');

    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });
});
