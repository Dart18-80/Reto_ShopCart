import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  buscarProductosDePrueba,
  productoDePrueba,
  simularBusquedaFallida,
  simularBusquedaProductos,
  type ProductoBusqueda,
} from '../../test/handlers/catalogo';
import { ANCHO_TELEFONO, simularPantalla } from '../../test/pantalla';
import { renderizar } from '../../test/renderizar';
import { useParametrosUrl } from '../hooks/useParametrosUrl';
import { FiltroTexto } from './FiltroTexto';
import { TablaServidor, type ColumnaTabla } from './TablaServidor';

// Cada prueba busca su propia consulta entre las recibidas: una petición en vuelo de la prueba anterior puede
// llegar al handler de la siguiente.

// Réplica del esquema de búsqueda del backend (catalogo.schemas.ts) sin los precios: el real pasa a
// packages/shared con el módulo Catálogo (05 §16).
const consultaProductosSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(20),
  texto: z.string().max(150).optional(),
  disponible: z.enum(['true', 'false']).optional(),
  orden: z.enum(['relevancia', 'precio', 'nombre', 'recientes']).default('relevancia'),
  direccion: z.enum(['asc', 'desc']).default('asc'),
});
type OrdenProductos = z.output<typeof consultaProductosSchema>['orden'];

const columnas: ColumnaTabla<ProductoBusqueda, OrdenProductos>[] = [
  { id: 'nombre', etiqueta: 'Nombre', celda: (p) => p.nombre, ordenable: 'nombre', prioridad: 1 },
  { id: 'categoria', etiqueta: 'Categoría', celda: (p) => p.categoria, prioridad: 2 },
  {
    id: 'precio',
    etiqueta: 'Precio',
    celda: (p) => `Q${p.precioMinimo}`,
    ordenable: 'precio',
    prioridad: 1,
    alineacion: 'fin',
  },
];

function TablaProductos() {
  const parametros = useParametrosUrl(consultaProductosSchema);
  const consulta = useQuery({
    queryKey: ['productos', 'prueba', parametros.valores],
    queryFn: () => buscarProductosDePrueba(parametros.valores),
    placeholderData: keepPreviousData,
  });

  return (
    <TablaServidor
      titulo="Productos"
      columnas={columnas}
      consulta={consulta}
      parametros={parametros}
      claveFila={(p) => p.idProducto}
      vacio={{ titulo: 'Todavía no hay productos' }}
      filtros={
        <div className="flex gap-4">
          <FiltroTexto parametros={parametros} campo="texto" etiqueta="Buscar" />
          <label>
            Disponibilidad
            <select
              value={parametros.valores.disponible ?? ''}
              onChange={(evento) => {
                parametros.cambiar({
                  disponible: evento.target.value === 'true' ? 'true' : undefined,
                });
              }}
            >
              <option value="">Todos</option>
              <option value="true">Disponibles</option>
            </select>
          </label>
        </div>
      }
    />
  );
}

const busqueda = (router: { state: { location: { search: string } } }) =>
  new URLSearchParams(router.state.location.search);

const encabezado = (nombre: string) =>
  screen.getByRole('columnheader', { name: new RegExp(nombre) });

describe('TablaServidor: estado en la URL', () => {
  it('ordenar con el teclado (Tab y Enter) escribe la URL y marca aria-sort en el encabezado', async () => {
    simularBusquedaProductos({ total: 5 });
    const { usuario, router } = renderizar(<TablaProductos />, { ruta: '/productos' });
    await screen.findByText('Producto 1');

    const botonNombre = screen.getByRole('button', { name: /Nombre/ });
    while (document.activeElement !== botonNombre) await usuario.tab();
    await usuario.keyboard('{Enter}');

    await waitFor(() => {
      expect(busqueda(router).get('orden')).toBe('nombre');
    });
    expect(encabezado('Nombre')).toHaveAttribute('aria-sort', 'ascending');
    expect(encabezado('Precio')).toHaveAttribute('aria-sort', 'none');
    expect(encabezado('Categoría')).not.toHaveAttribute('aria-sort');

    await usuario.keyboard('{Enter}');
    await waitFor(() => {
      expect(encabezado('Nombre')).toHaveAttribute('aria-sort', 'descending');
    });
    expect(busqueda(router).get('direccion')).toBe('desc');
  });

  it('paginar escribe la URL y «atrás» vuelve a la página anterior', async () => {
    simularBusquedaProductos({ total: 45 });
    const { usuario, router } = renderizar(<TablaProductos />, { ruta: '/productos' });
    await screen.findByText('Página 1 de 3, 45 resultados');

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Página 2 de 3, 45 resultados')).toBeInTheDocument();
    expect(busqueda(router).get('pagina')).toBe('2');
    await router.navigate(-1);
    expect(await screen.findByText('Página 1 de 3, 45 resultados')).toBeInTheDocument();
  });

  it('al recargar con la URL, la vista se conserva', async () => {
    const busquedaSimulada = simularBusquedaProductos({ total: 45 });

    renderizar(<TablaProductos />, { ruta: '/productos?pagina=2&orden=precio&direccion=desc' });

    expect(await screen.findByText('Página 2 de 3, 45 resultados')).toBeInTheDocument();
    expect(encabezado('Precio')).toHaveAttribute('aria-sort', 'descending');
    expect(busquedaSimulada.consultas.map(String)).toContain(
      'pagina=2&tamano=20&orden=precio&direccion=desc',
    );
  });

  it('un valor inválido en la URL cae al valor por defecto del esquema', async () => {
    const busquedaSimulada = simularBusquedaProductos({ total: 5 });

    renderizar(<TablaProductos />, { ruta: '/productos?pagina=abc&orden=inexistente&tamano=5' });

    await screen.findByText('Producto 1');
    expect(busquedaSimulada.consultas.map(String)).toContain(
      'pagina=1&tamano=5&orden=relevancia&direccion=asc',
    );
  });

  it('cambiar un filtro de selección vuelve a la página 1 y agrega una entrada al historial', async () => {
    simularBusquedaProductos({ total: 45 });
    const { usuario, router } = renderizar(<TablaProductos />, { ruta: '/productos?pagina=3' });
    await screen.findByText('Página 3 de 3, 45 resultados');

    await usuario.selectOptions(screen.getByLabelText('Disponibilidad'), 'Disponibles');

    await waitFor(() => {
      expect(busqueda(router).get('disponible')).toBe('true');
    });
    expect(busqueda(router).has('pagina')).toBe(false);
    expect(router.state.historyAction).toBe('PUSH');
  });

  it('una página fuera de rango salta a la última, reemplazando la entrada del historial', async () => {
    simularBusquedaProductos({ total: 45 });
    const { router } = renderizar(<TablaProductos />, { ruta: '/productos?pagina=9' });

    expect(await screen.findByText('Página 3 de 3, 45 resultados')).toBeInTheDocument();
    expect(busqueda(router).get('pagina')).toBe('3');
    expect(router.state.historyAction).toBe('REPLACE');
  });

  it('con total 0, la página se queda en 1 y nunca salta a 0', async () => {
    const busquedaSimulada = simularBusquedaProductos({ total: 0 });
    const { router } = renderizar(<TablaProductos />, { ruta: '/productos?pagina=4' });

    expect(await screen.findByText('Todavía no hay productos')).toBeInTheDocument();
    await waitFor(() => {
      expect(busqueda(router).has('pagina')).toBe(false);
    });
    expect(busquedaSimulada.consultas.map((c) => c.get('pagina'))).not.toContain('0');
  });

  it('escribir dos veces en el buscador y volver atrás regresa a la vista anterior a la búsqueda', async () => {
    simularBusquedaProductos({ total: 5 });
    const { usuario, router } = renderizar(<TablaProductos />, { ruta: '/productos' });
    await screen.findByText('Producto 1');
    await usuario.click(screen.getByRole('button', { name: /Precio/ }));
    await waitFor(() => {
      expect(busqueda(router).get('orden')).toBe('precio');
    });

    const buscador = screen.getByRole('searchbox', { name: 'Buscar' });
    await usuario.type(buscador, 'cam');
    await waitFor(() => {
      expect(busqueda(router).get('texto')).toBe('cam');
    });
    await usuario.type(buscador, 'isa');
    await waitFor(() => {
      expect(busqueda(router).get('texto')).toBe('camisa');
    });

    await router.navigate(-1);

    await waitFor(() => {
      expect(busqueda(router).has('texto')).toBe(false);
    });
    expect(busqueda(router).get('orden')).toBe('precio');
    expect(buscador).toHaveValue('');
  });
});

describe('TablaServidor: estados', () => {
  it('mientras carga una página nueva conserva los datos y avisa «Actualizando…» en una región aria-live', async () => {
    simularBusquedaProductos({ total: 45, demoraDespuesDeLaPrimera: 200 });
    const { usuario } = renderizar(<TablaProductos />, { ruta: '/productos' });
    await screen.findByText('Producto 1');

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));

    const region = await screen.findByText('Actualizando…');
    expect(region.closest('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Producto 1')).toBeInTheDocument();
    expect(await screen.findByText('Producto 21')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'false');
  });

  it('sin registros muestra el vacío de la vista', async () => {
    simularBusquedaProductos({ total: 0 });

    renderizar(<TablaProductos />, { ruta: '/productos' });

    expect(await screen.findByText('Todavía no hay productos')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).not.toBeInTheDocument();
  });

  it('sin resultados con filtros lo dice y ofrece limpiarlos', async () => {
    simularBusquedaProductos({ total: 0 });
    const { usuario, router } = renderizar(<TablaProductos />, {
      ruta: '/productos?texto=zzz&disponible=true&orden=precio',
    });

    expect(await screen.findByText('Ningún resultado con estos filtros')).toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    await waitFor(() => {
      expect(busqueda(router).has('texto')).toBe(false);
    });
    expect(busqueda(router).has('disponible')).toBe(false);
    expect(busqueda(router).get('orden')).toBe('precio');
  });

  it('un error muestra el mensaje del backend, su requestId y Reintentar', async () => {
    simularBusquedaFallida('req-tabla-1');
    const { usuario } = renderizar(<TablaProductos />, { ruta: '/productos' });

    expect(await screen.findByRole('alert')).toHaveTextContent('Algo salió mal de nuestro lado');
    expect(screen.getByRole('alert')).toHaveTextContent('req-tabla-1');
    simularBusquedaProductos({ total: 2 });
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByText('Producto 2')).toBeInTheDocument();
  });
});

describe('TablaServidor: pantallas angostas', () => {
  it('en 375 px muestra tarjetas con las columnas de prioridad 1, no la tabla', async () => {
    simularPantalla(ANCHO_TELEFONO);
    simularBusquedaProductos({ total: 2 });

    renderizar(<TablaProductos />, { ruta: '/productos' });

    const tarjetas = await screen.findByRole('list', { name: 'Productos' });
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const [primera] = within(tarjetas).getAllByRole('listitem');
    expect(primera).toHaveTextContent(productoDePrueba(1).nombre);
    expect(primera).toHaveTextContent('Precio');
    expect(primera).not.toHaveTextContent('Categoría');
  });
});
