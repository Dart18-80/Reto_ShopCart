import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  productoDePrueba,
  simularBusquedaFallida,
  simularBusquedaProductos,
  simularCategorias,
  simularProductos,
} from '../../../test/handlers/catalogo';
import { renderizarRutas } from '../../../test/renderizar';

const abrirCatalogo = (ruta = '/') => {
  simularCategorias();
  return renderizarRutas(crearRutas(), { ruta });
};

const ultimaConsulta = (consultas: URLSearchParams[]) => consultas.at(-1);

describe('CatalogoPagina: tarjetas (M2-H02)', () => {
  it('cada tarjeta muestra la prenda de su categoría con el primer color, sus muestras, «Desde» y el precio, y enlaza al detalle', async () => {
    simularProductos([
      {
        ...productoDePrueba(7),
        nombre: 'Polo de piqué',
        precioMinimo: '189.00',
        ilustracion: 'Camisa',
        colores: ['Azul marino', 'Blanco', 'Rojo'],
      },
    ]);
    abrirCatalogo();

    const tarjeta = await screen.findByRole('link', { name: /Polo de piqué/ });
    expect(tarjeta).toHaveAttribute('href', '/productos/7');
    expect(
      within(tarjeta).getByRole('img', { name: 'Camisa color Azul marino' }),
    ).toBeInTheDocument();
    expect(within(tarjeta).getByText('Colores: Azul marino, Blanco, Rojo')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Desde')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Q189.00')).toBeInTheDocument();
    expect(within(tarjeta).getByText('Disponible')).toBeInTheDocument();
  });

  it('un producto sin disponible dice «Agotado» (N-06: nunca una cifra) y uno sin colores se dibuja en neutro', async () => {
    simularProductos([
      { ...productoDePrueba(8), nombre: 'Tenis urbanos', disponible: false, ilustracion: 'Tenis' },
    ]);
    abrirCatalogo();

    const tarjeta = await screen.findByRole('link', { name: /Tenis urbanos/ });
    expect(within(tarjeta).getByText('Agotado')).toBeInTheDocument();
    expect(within(tarjeta).getByRole('img', { name: 'Tenis' })).toBeInTheDocument();
  });
});

describe('CatalogoPagina: filtros en la URL (FE-06)', () => {
  it('elegir una categoría la escribe en la URL, la pide al backend y la pone de título', async () => {
    const { consultas } = simularBusquedaProductos({ total: 3 });
    const { usuario, router } = abrirCatalogo();

    await usuario.click(await screen.findByRole('button', { name: 'Calzado' }));

    expect(router.state.location.search).toBe('?categoria=5');
    expect(await screen.findByRole('heading', { level: 1, name: 'Calzado' })).toBeInTheDocument();
    await waitFor(() => {
      expect(ultimaConsulta(consultas)?.get('categoria')).toBe('5');
    });
    expect(screen.getByRole('button', { name: 'Calzado' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ordenar por mayor precio cambia la URL y la consulta', async () => {
    const { consultas } = simularBusquedaProductos({ total: 3 });
    const { usuario, router } = abrirCatalogo();

    await usuario.selectOptions(
      await screen.findByRole('combobox', { name: 'Ordenar' }),
      'Precio: de mayor a menor',
    );

    expect(new URLSearchParams(router.state.location.search).get('orden')).toBe('precio');
    expect(new URLSearchParams(router.state.location.search).get('direccion')).toBe('desc');
    await waitFor(() => {
      expect(ultimaConsulta(consultas)?.get('direccion')).toBe('desc');
    });
  });

  it('un precio mínimo mayor que el máximo muestra el mensaje del esquema y no consulta', async () => {
    const { consultas } = simularBusquedaProductos({ total: 3 });
    const { usuario, router } = abrirCatalogo();
    const filtros = await screen.findByRole('form', { name: 'Rango de precio' });

    await usuario.type(within(filtros).getByLabelText('Precio mínimo'), '400');
    await usuario.type(within(filtros).getByLabelText('Precio máximo'), '100');
    // Salir del par de campos aplica el rango, igual que Enter.
    await usuario.click(screen.getByRole('heading', { level: 1 }));

    expect(within(filtros).getByLabelText('Precio mínimo')).toHaveAccessibleDescription(
      'El precio mínimo no puede ser mayor que el máximo.',
    );
    expect(router.state.location.search).toBe('');
    expect(consultas.every((consulta) => !consulta.has('precioMin'))).toBe(true);
  });

  it('un rango válido y «Solo con existencia» se aplican, y «Filtros (n)» cuenta los activos', async () => {
    const { consultas } = simularBusquedaProductos({ total: 3 });
    const { usuario, router } = abrirCatalogo();
    const filtros = await screen.findByRole('form', { name: 'Rango de precio' });

    await usuario.type(within(filtros).getByLabelText('Precio mínimo'), '100');
    await usuario.keyboard('{Enter}');
    await usuario.click(screen.getByRole('checkbox', { name: 'Solo con existencia' }));

    const busqueda = new URLSearchParams(router.state.location.search);
    expect(busqueda.get('precioMin')).toBe('100');
    expect(busqueda.get('disponible')).toBe('true');
    await waitFor(() => {
      expect(ultimaConsulta(consultas)?.get('disponible')).toBe('true');
    });
    expect(screen.getByRole('button', { name: 'Filtros (2)' })).toBeInTheDocument();
  });

  it('paginar escribe la página en la URL y «atrás» vuelve a la anterior', async () => {
    simularBusquedaProductos({ total: 45 });
    const { usuario, router } = abrirCatalogo();

    await usuario.click(await screen.findByRole('button', { name: 'Siguiente' }));
    expect(router.state.location.search).toBe('?pagina=2');
    expect(await screen.findByText('Página 2 de 3, 45 resultados')).toBeInTheDocument();

    await router.navigate(-1);
    expect(router.state.location.search).toBe('');
    expect(await screen.findByText('Página 1 de 3, 45 resultados')).toBeInTheDocument();
  });

  it('recargar con filtros en la URL conserva la vista', async () => {
    const { consultas } = simularBusquedaProductos({ total: 3 });
    abrirCatalogo('/?categoria=1&precioMax=300&orden=nombre');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Camisas y blusas' }),
    ).toBeInTheDocument();
    const filtros = screen.getByRole('form', { name: 'Rango de precio' });
    expect(within(filtros).getByLabelText('Precio máximo')).toHaveValue('300');
    expect(screen.getByRole('combobox', { name: 'Ordenar' })).toHaveDisplayValue('Nombre');
    expect(ultimaConsulta(consultas)?.get('precioMax')).toBe('300');
  });
});

describe('CatalogoPagina: estados', () => {
  it('sin productos y sin filtros: «Todavía no hay productos»', async () => {
    simularBusquedaProductos({ total: 0 });
    abrirCatalogo();

    expect(await screen.findByText('Todavía no hay productos')).toBeInTheDocument();
  });

  it('sin resultados con filtros: el mensaje con filtros y «Limpiar filtros» los quita', async () => {
    simularBusquedaProductos({ total: 0 });
    const { usuario, router } = abrirCatalogo('/?disponible=true');

    expect(await screen.findByText('Ningún producto con estos filtros')).toBeInTheDocument();
    const vacio = screen.getByText('Ningún producto con estos filtros').parentElement;
    await usuario.click(
      within(vacio ?? document.body).getByRole('button', { name: 'Limpiar filtros' }),
    );

    expect(router.state.location.search).toBe('');
  });

  it('si la búsqueda falla muestra el error del backend con Reintentar y el código de la solicitud', async () => {
    simularBusquedaFallida('req-catalogo-1');
    abrirCatalogo();

    expect(await screen.findByText('El servicio de búsqueda falló.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(screen.getByText(/req-catalogo-1/)).toBeInTheDocument();
  });

  it('mientras carga muestra el esqueleto de las tarjetas', async () => {
    simularBusquedaProductos({ total: 3 });
    abrirCatalogo();

    const cargando = await screen.findAllByRole('status');
    expect(cargando.length).toBeGreaterThan(0);
    expect(cargando.every((estado) => estado.textContent.includes('Cargando'))).toBe(true);
    expect(await screen.findAllByRole('link', { name: /Producto/ })).toHaveLength(3);
  });
});
