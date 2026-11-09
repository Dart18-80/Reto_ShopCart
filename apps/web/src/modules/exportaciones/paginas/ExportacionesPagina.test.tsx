import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearRutas } from '../../../app/router';
import { exportacionDePrueba, simularExportaciones } from '../../../test/handlers/exportaciones';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = (rol: 'Administrador' | 'Operador' = 'Administrador') =>
  renderizarRutas(crearRutas(), { ruta: '/backoffice/exportaciones', rol });

const fila = async (texto: string) =>
  within((await screen.findByText(texto)).closest('tr') ?? document.body);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ExportacionesPagina (M11-H03)', () => {
  it('cada exportación con su reporte, filtros, formato, fecha y estado; si falló, el mensaje del backend', async () => {
    simularExportaciones({
      listas: [
        [
          exportacionDePrueba(),
          exportacionDePrueba({
            idExportacion: 8,
            reporte: 'top-productos',
            formato: 'pdf',
            filtros: {},
            estado: 'Fallida',
            error: 'El reporte tiene demasiadas filas para un PDF.',
            archivo: null,
          }),
        ],
      ],
    });
    abrir();

    const ventas = await fila('Ventas por periodo');
    expect(ventas.getByText('Del 1 nov 2026 al 8 nov 2026 · por día')).toBeInTheDocument();
    expect(ventas.getByText('Excel')).toBeInTheDocument();
    expect(ventas.getByText('8 nov 2026, 10:00')).toBeInTheDocument();
    expect(ventas.getByText('Lista para descargar')).toBeInTheDocument();
    expect(ventas.getByRole('button', { name: 'Descargar' })).toBeInTheDocument();

    const top = await fila('Top 10 productos');
    expect(top.getByText('Últimos 30 días')).toBeInTheDocument();
    expect(top.getByText('No se pudo generar')).toBeInTheDocument();
    expect(top.getByText('El reporte tiene demasiadas filas para un PDF.')).toBeInTheDocument();
    expect(top.queryByRole('button', { name: 'Descargar' })).not.toBeInTheDocument();
  });

  it('mientras una se genera, la lista se vuelve a pedir sola hasta que está lista', async () => {
    simularExportaciones({
      listas: [
        [exportacionDePrueba({ estado: 'Procesando', archivo: null })],
        [exportacionDePrueba()],
      ],
    });
    abrir();

    expect(await screen.findByText('Generando el archivo…')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Descargar' })).toBeInTheDocument();
  });

  it('«Descargar» guarda el archivo con el nombre que manda el backend', async () => {
    simularExportaciones();
    // jsdom no implementa los object URL: una subclase con los dos estáticos, que unstubAllGlobals retira.
    vi.stubGlobal(
      'URL',
      class extends URL {
        static override createObjectURL = vi.fn(() => 'blob:prueba');
        static override revokeObjectURL = vi.fn();
      },
    );
    const nombres: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      nombres.push(this.download);
    });
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Descargar' }));

    await vi.waitFor(() => {
      expect(nombres).toEqual(['ventas-por-día.xlsx']);
    });
  });

  it('sin exportaciones, dice dónde se piden', async () => {
    simularExportaciones({ listas: [[]] });
    abrir();

    expect(await screen.findByText('Todavía no has exportado ningún reporte')).toBeInTheDocument();
  });

  it('un Operador ve «Sin permiso»', async () => {
    abrir('Operador');

    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });
});
