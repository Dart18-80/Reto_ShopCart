import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  categoriaAdminDePrueba,
  productoResumenDePrueba,
  simularCatalogoAdmin,
  simularProductosAdmin,
} from '../../../test/handlers/catalogo-admin';
import { renderizarRutas } from '../../../test/renderizar';
import { servidor } from '../../../test/servidor';

const abrir = (ruta = '/backoffice/catalogo') =>
  renderizarRutas(crearRutas(), { ruta, rol: 'Administrador' });

const OXFORD = productoResumenDePrueba();
const GORRA = productoResumenDePrueba({
  idProducto: 6,
  nombre: 'Gorra de lona',
  categoria: 'Accesorios',
  activo: false,
  variantes: 3,
  variantesActivas: 2,
});

function preparar() {
  simularCatalogoAdmin([
    categoriaAdminDePrueba(),
    categoriaAdminDePrueba({ idCategoria: 2, nombre: 'Accesorios' }),
  ]);
  return simularProductosAdmin([OXFORD, GORRA]);
}

describe('GestionCatalogoPagina, productos y precios (M6-H03)', () => {
  it('la tabla: producto, categoría, variantes activas de total, estado y «Editar»', async () => {
    preparar();
    abrir();

    const tabla = within(await screen.findByRole('table', { name: 'Productos' }));
    const fila = within(tabla.getByText('Gorra de lona').closest('tr') ?? document.body);
    expect(fila.getByText('Accesorios')).toBeInTheDocument();
    expect(fila.getByText('2 de 3')).toBeInTheDocument();
    expect(fila.getByText('Inactivo')).toBeInTheDocument();
    expect(fila.getByRole('link', { name: 'Editar Gorra de lona' })).toHaveAttribute(
      'href',
      '/backoffice/catalogo/productos/6',
    );
    expect(screen.getByRole('link', { name: 'Categorías y atributos' })).toHaveAttribute(
      'href',
      '/backoffice/catalogo/categorias',
    );
  });

  it('ordenar por nombre y por categoría cambia la URL y lo pide al servidor', async () => {
    const consultas = preparar();
    const { usuario, router } = abrir();

    const tabla = within(await screen.findByRole('table', { name: 'Productos' }));
    await usuario.click(tabla.getByRole('button', { name: /Categoría/ }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?orden=categoria');
    });
    await waitFor(() => {
      expect(consultas.at(-1)?.get('orden')).toBe('categoria');
    });

    await usuario.click(tabla.getByRole('button', { name: /Producto/ }));
    await usuario.click(tabla.getByRole('button', { name: /Producto/ }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?direccion=desc');
    });
    expect(consultas.at(-1)?.get('direccion')).toBe('desc');
  });

  it('filtrar por «Inactivos» pide los desactivados', async () => {
    const consultas = preparar();
    const { usuario, router } = abrir();

    await usuario.selectOptions(await screen.findByLabelText('Estado'), 'Inactivos');

    await waitFor(() => {
      expect(router.state.location.search).toBe('?activo=false');
    });
    await waitFor(() => {
      expect(consultas.at(-1)?.get('activo')).toBe('false');
    });
  });

  it('filtrar por categoría y por texto llega al servidor', async () => {
    const consultas = preparar();
    const { usuario } = abrir();

    await screen.findByRole('option', { name: 'Accesorios' });
    await usuario.selectOptions(screen.getByLabelText('Categoría'), 'Accesorios');
    await usuario.type(screen.getByLabelText('Buscar'), 'gorra');

    await waitFor(() => {
      expect(consultas.at(-1)?.get('texto')).toBe('gorra');
    });
    expect(consultas.at(-1)?.get('categoria')).toBe('2');
  });

  it('«Nuevo producto» crea el producto y va a su editor', async () => {
    preparar();
    const recibidos: unknown[] = [];
    servidor.use(
      http.post('/api/v1/admin/productos', async ({ request }) => {
        recibidos.push(await request.json());
        return HttpResponse.json(
          {
            datos: {
              idProducto: 77,
              idCategoria: 2,
              categoria: 'Accesorios',
              nombre: 'Bufanda',
              descripcion: null,
              activo: true,
              imagenes: [],
              variantes: [],
            },
          },
          { status: 201 },
        );
      }),
    );
    const { usuario, router } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo producto' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Nuevo producto' }));
    await usuario.type(dialogo.getByLabelText('Nombre'), 'Bufanda');
    await usuario.selectOptions(dialogo.getByLabelText('Categoría'), 'Accesorios');
    await usuario.click(dialogo.getByRole('button', { name: 'Crear producto' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/backoffice/catalogo/productos/77');
    });
    expect(recibidos).toEqual([{ nombre: 'Bufanda', idCategoria: 2, activo: true }]);
  });

  it('sin categoría elegida, el formulario lo marca con el mismo esquema que la API', async () => {
    preparar();
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo producto' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Nuevo producto' }));
    await usuario.type(dialogo.getByLabelText('Nombre'), 'Bufanda');
    await usuario.click(dialogo.getByRole('button', { name: 'Crear producto' }));

    expect(dialogo.getByLabelText('Categoría')).toHaveAccessibleDescription('Elige una categoría.');
  });
});
