import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  productoDetalleDePrueba,
  simularProducto,
  simularProductoFallido,
} from '../../../test/handlers/catalogo';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = (ruta = '/productos/50') => renderizarRutas(crearRutas(), { ruta });
const grupo = (nombre: string) => screen.getByRole('group', { name: nombre });
const opcion = (grupoNombre: string, valor: string) =>
  within(grupo(grupoNombre)).getByRole('button', { name: valor });
const varianteEnLaUrl = (router: ReturnType<typeof abrir>['router']) =>
  new URLSearchParams(router.state.location.search).get('variante');

describe('ProductoPagina: elegir la variante (M2-H03)', () => {
  it('con Azul elegido, XL queda deshabilitada con «XL agotada en Azul»', async () => {
    simularProducto();
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Azul' }));

    expect(opcion('Talla', 'XL')).toBeDisabled();
    expect(within(grupo('Talla')).getByText('XL agotada en Azul')).toBeInTheDocument();
    expect(opcion('Talla', 'M')).toBeEnabled();
    expect(screen.getByText('Color: Azul')).toBeInTheDocument();
  });

  it('y viceversa: XL agotada se ve deshabilitada y, con L elegida, Celeste no existe y Blanco sí', async () => {
    simularProducto();
    const { usuario } = abrir();

    // Con nada elegido, XL forma una variante (agotada): se ve deshabilitada.
    expect(await screen.findByRole('button', { name: 'XL' })).toBeDisabled();
    await usuario.click(opcion('Talla', 'L'));

    expect(opcion('Color', 'Celeste')).toBeDisabled();
    expect(within(grupo('Color')).getByText('Celeste no disponible en L')).toBeInTheDocument();
    expect(opcion('Color', 'Blanco')).toBeEnabled();
  });

  it('elegir talla y color resuelve la variante: su precio, su existencia y la variante en la URL', async () => {
    simularProducto();
    const { usuario, router } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Blanco' }));
    await usuario.click(opcion('Talla', 'M'));

    expect(varianteEnLaUrl(router)).toBe('4');
    expect(screen.getByText('Q259.00')).toBeInTheDocument();
    expect(screen.getByText('Incluye IVA del 12 %')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Camisa color Blanco' })).toBeInTheDocument();
  });

  it('la variante de la URL se restaura al recargar, con «Últimas N unidades» solo en UltimasUnidades (N-06)', async () => {
    simularProducto();
    abrir('/productos/50?variante=5');

    expect(await screen.findByText('Últimas 2 unidades')).toBeInTheDocument();
    expect(opcion('Talla', 'L')).toHaveAttribute('aria-pressed', 'true');
    expect(opcion('Color', 'Blanco')).toHaveAttribute('aria-pressed', 'true');
  });

  it('una variante Disponible no muestra ninguna cifra de existencia', async () => {
    simularProducto();
    abrir('/productos/50?variante=4');

    expect(await screen.findByText('Disponible')).toBeInTheDocument();
    expect(screen.queryByText(/unidades/)).not.toBeInTheDocument();
  });

  it('una variante de la URL que no es del producto se ignora: no hay nada elegido', async () => {
    simularProducto();
    abrir('/productos/50?variante=999');

    expect(await screen.findByRole('button', { name: 'Elige talla y color' })).toBeDisabled();
    expect(opcion('Talla', 'M')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Desde')).toBeInTheDocument();
    expect(screen.getByText('Q249.00')).toBeInTheDocument();
  });

  it('mientras falte un atributo, «Agregar al carrito» queda deshabilitado con lo que falta', async () => {
    simularProducto();
    const { usuario } = abrir();

    expect(await screen.findByRole('button', { name: 'Elige talla y color' })).toBeDisabled();
    await usuario.click(opcion('Color', 'Azul'));
    expect(screen.getByRole('button', { name: 'Elige talla' })).toBeDisabled();
  });
});

describe('ProductoPagina: contenido', () => {
  it('el aviso de la garantía usa el plazo que manda el backend', async () => {
    simularProducto(productoDetalleDePrueba({ diasGarantiaPrecio: 5 }));
    abrir();

    expect(
      await screen.findByText(
        'Al agregarlo, su precio queda garantizado por 5 días: si sube, pagas el anterior; si baja, pagas el nuevo.',
      ),
    ).toBeInTheDocument();
  });

  it('la galería muestra primero la ilustración y deja elegir las imágenes del producto', async () => {
    simularProducto(
      productoDetalleDePrueba({
        imagenes: [
          {
            idImagenProducto: 1,
            url: '/static/productos/oxford.svg',
            textoAlternativo: 'Camisa Oxford doblada',
            orden: 1,
            esPrincipal: true,
          },
        ],
      }),
    );
    const { usuario } = abrir();

    const galeria = await screen.findByRole('region', { name: 'Galería' });
    expect(within(galeria).getAllByRole('img', { name: /^Camisa/ })[0]).toHaveAttribute(
      'role',
      'img',
    );
    await usuario.click(
      within(galeria).getByRole('button', { name: 'Ver: Camisa Oxford doblada' }),
    );

    expect(within(galeria).getByRole('img', { name: 'Camisa Oxford doblada' })).toHaveAttribute(
      'src',
      '/static/productos/oxford.svg',
    );
  });

  it('un producto que no existe (404) muestra «No encontrado»', async () => {
    simularProducto();
    abrir('/productos/77');

    expect(
      await screen.findByRole('heading', { name: 'No encontramos este producto' }),
    ).toBeInTheDocument();
  });

  it('un id que no es un número muestra «No encontrado» sin consultar', async () => {
    abrir('/productos/abc');

    expect(
      await screen.findByRole('heading', { name: 'No encontramos este producto' }),
    ).toBeInTheDocument();
  });

  it('si el detalle falla, muestra el error con Reintentar', async () => {
    simularProductoFallido('req-detalle-1');
    abrir();

    expect(await screen.findByText('No pudimos cargar el producto.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
