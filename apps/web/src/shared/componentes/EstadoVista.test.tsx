import { useQuery } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  buscarProductosDePrueba,
  simularBusquedaFallida,
  simularBusquedaProductos,
} from '../../test/handlers/catalogo';
import { renderizar } from '../../test/renderizar';
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

  it('con error muestra el mensaje del backend, el requestId y Reintentar', async () => {
    simularBusquedaFallida('req-estado-1');
    const { usuario } = renderizar(<ListaProductos />);

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('Algo salió mal de nuestro lado');
    expect(aviso).toHaveTextContent('Código de la solicitud: req-estado-1');

    simularBusquedaProductos({ total: 1 });
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Producto 1')).toBeInTheDocument();
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
