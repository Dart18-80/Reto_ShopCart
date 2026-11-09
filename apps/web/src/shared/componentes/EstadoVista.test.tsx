import { onlineManager, useQuery } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buscarProductosDePrueba,
  simularBusquedaFallida,
  simularBusquedaProductos,
} from '../../test/handlers/catalogo';
import { renderizar } from '../../test/renderizar';
import { servidor } from '../../test/servidor';
import { EstadoVista } from './EstadoVista';

function ListaProductos() {
  const consulta = useQuery({
    queryKey: ['productos', 'estado-vista'],
    queryFn: () => buscarProductosDePrueba(),
  });
  return (
    <EstadoVista
      consulta={consulta}
      vacio={{ titulo: 'Todavía no hay productos', descripcion: 'Vuelve pronto.' }}
    >
      {({ datos }) => (
        <ul>
          {datos.map((p) => (
            <li key={p.idProducto}>{p.nombre}</li>
          ))}
        </ul>
      )}
    </EstadoVista>
  );
}

// Un recurso que siempre existe (un resumen, el estado de una exportación): sin vacío, la respuesta se muestra tal cual.
function TotalProductos() {
  const consulta = useQuery({
    queryKey: ['productos', 'estado-vista-sin-vacio'],
    queryFn: () => buscarProductosDePrueba(),
  });
  return (
    <EstadoVista consulta={consulta}>
      {({ paginacion }) => <p>{`Total: ${String(paginacion.total)}`}</p>}
    </EstadoVista>
  );
}

describe('EstadoVista', () => {
  it('mientras carga muestra el esqueleto con un estado accesible', async () => {
    simularBusquedaProductos({ total: 1 });

    renderizar(<ListaProductos />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    expect(await screen.findByText('Producto 1')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('sin datos muestra el vacío con su título y descripción', async () => {
    simularBusquedaProductos({ total: 0 });

    renderizar(<ListaProductos />);

    expect(await screen.findByText('Todavía no hay productos')).toBeInTheDocument();
    expect(screen.getByText('Vuelve pronto.')).toBeInTheDocument();
  });

  it('sin `vacio`, una respuesta sin elementos se muestra igual: no hay estado vacío', async () => {
    simularBusquedaProductos({ total: 0 });

    renderizar(<TotalProductos />);

    expect(await screen.findByText('Total: 0')).toBeInTheDocument();
  });

  it('con error muestra el mensaje del backend, el requestId y Reintentar', async () => {
    simularBusquedaFallida('req-estado-1');
    const { usuario } = renderizar(<ListaProductos />);

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('El servicio de búsqueda falló.');
    expect(aviso).toHaveTextContent('Código de la solicitud: req-estado-1');

    simularBusquedaProductos({ total: 1 });
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Producto 1')).toBeInTheDocument();
  });

  it('muestra el mensaje propio del backend, no uno genérico', async () => {
    simularBusquedaFallida('req-estado-404', {
      status: 404,
      codigo: 'CATEGORIA_INEXISTENTE',
      mensaje: 'Esa categoría ya no existe.',
    });

    renderizar(<ListaProductos />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Esa categoría ya no existe.');
  });

  it('si una consulta que ya tenía datos falla al recargar, los datos se quedan con el aviso arriba', async () => {
    simularBusquedaProductos({ total: 1 });
    const { queryClient } = renderizar(<ListaProductos />);
    await screen.findByText('Producto 1');

    simularBusquedaFallida('req-estado-2');
    await queryClient.refetchQueries({ queryKey: ['productos', 'estado-vista'] });

    expect(await screen.findByRole('alert')).toHaveTextContent('req-estado-2');
    expect(screen.getByText('Producto 1')).toBeInTheDocument();
  });
});

describe('EstadoVista sin conexión (FE-02: networkMode always)', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
  });

  it('sin red la consulta no se queda pausada en el esqueleto: muestra «Sin conexión» y Reintentar', async () => {
    onlineManager.setOnline(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    servidor.use(http.get('/api/v1/productos', () => HttpResponse.error()));

    renderizar(<ListaProductos />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sin conexión. Revisa tu internet e intenta de nuevo.',
    );
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
