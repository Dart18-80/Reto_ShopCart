import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  atributoDePrueba,
  categoriaAdminDePrueba,
  productoAdminDePrueba,
  simularCatalogoAdmin,
  simularProductoAdmin,
  varianteAdminDePrueba,
} from '../../../test/handlers/catalogo-admin';
import { renderizarRutas } from '../../../test/renderizar';
import { servidor } from '../../../test/servidor';

const abrir = () =>
  renderizarRutas(crearRutas(), { ruta: '/backoffice/catalogo/productos/5', rol: 'Administrador' });

const TALLA = atributoDePrueba();
const COLOR = atributoDePrueba({
  idAtributo: 2,
  nombre: 'Color',
  valores: [
    { idValorAtributo: 21, valor: 'Azul', orden: 1 },
    { idValorAtributo: 22, valor: 'Blanco', orden: 2 },
  ],
});

function preparar(errores = {}) {
  simularCatalogoAdmin(
    [categoriaAdminDePrueba(), categoriaAdminDePrueba({ idCategoria: 2, nombre: 'Accesorios' })],
    [TALLA, COLOR],
  );
  return simularProductoAdmin(
    productoAdminDePrueba({
      variantes: [
        varianteAdminDePrueba(),
        varianteAdminDePrueba({
          idVariante: 51,
          sku: 'CAM-OXF-BL-S',
          descripcionAtributos: 'Blanco / S',
          activo: false,
          precio: null,
          existenciaFisica: 0,
          reservado: 0,
          disponible: 0,
        }),
      ],
    }),
    errores,
  );
}

const variantes = async () => within(await screen.findByRole('region', { name: 'Variantes' }));

describe('ProductoAdminPagina, el editor de producto (M6-H04)', () => {
  it('muestra los datos, las imágenes y las variantes con su disponible de la física y lo reservado', async () => {
    preparar();
    abrir();

    expect(
      await screen.findByRole('heading', { name: 'Camisa Oxford', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveValue('Camisa Oxford');
    expect(screen.getByText('/static/productos/camisas.svg')).toBeInTheDocument();
    const tabla = await variantes();
    const azul = within(tabla.getByText('CAM-OXF-AZ-M').closest('tr') ?? document.body);
    expect(azul.getByText('Q249.00')).toBeInTheDocument();
    expect(azul.getByText('22 de 24 (2 reservadas)')).toBeInTheDocument();
    const blanco = within(tabla.getByText('CAM-OXF-BL-S').closest('tr') ?? document.body);
    expect(blanco.getByText('Sin precio')).toBeInTheDocument();
    expect(blanco.getByText('Inactiva')).toBeInTheDocument();
    expect(blanco.getByRole('button', { name: 'Activar CAM-OXF-BL-S' })).toBeInTheDocument();
  });

  it('«Guardar cambios» envía los datos del producto', async () => {
    const recibidos = preparar();
    const { usuario } = abrir();

    const nombre = await screen.findByLabelText('Nombre');
    await usuario.clear(nombre);
    await usuario.type(nombre, 'Camisa Oxford slim');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(recibidos[0]).toMatchObject({
        metodo: 'PATCH',
        ruta: 'producto',
        cuerpo: { nombre: 'Camisa Oxford slim', idCategoria: 1 },
      });
    });
  });

  it('eliminar un producto con ventas muestra PRODUCTO_CON_HISTORIAL y ofrece desactivarlo', async () => {
    const recibidos = preparar({
      'DELETE producto': {
        status: 409,
        codigo: 'PRODUCTO_CON_HISTORIAL',
        mensaje: 'El producto tiene ventas o movimientos: desactívalo en lugar de eliminarlo.',
      },
    });
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar producto' }));
    const confirmacion = within(await screen.findByRole('alertdialog'));
    await usuario.click(confirmacion.getByRole('button', { name: 'Eliminar producto' }));
    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent(
      'El producto tiene ventas o movimientos: desactívalo en lugar de eliminarlo.',
    );
    await usuario.click(within(aviso).getByRole('button', { name: 'Desactivar producto' }));

    await waitFor(() => {
      expect(recibidos.map((r) => `${r.metodo} ${r.ruta}`)).toEqual([
        'DELETE producto',
        'POST desactivar',
      ]);
    });
  });

  it('eliminar pide confirmación: «Cancelar» no envía nada', async () => {
    const recibidos = preparar();
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar producto' }));
    const confirmacion = within(
      await screen.findByRole('alertdialog', { name: '¿Eliminar Camisa Oxford?' }),
    );
    await usuario.click(confirmacion.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(recibidos).toEqual([]);
  });

  it('eliminar una variante confirmada la envía al backend', async () => {
    const recibidos = preparar();
    const { usuario } = abrir();

    const tabla = await variantes();
    await usuario.click(tabla.getByRole('button', { name: 'Eliminar CAM-OXF-BL-S' }));
    const confirmacion = within(
      await screen.findByRole('alertdialog', { name: '¿Eliminar CAM-OXF-BL-S?' }),
    );
    await usuario.click(confirmacion.getByRole('button', { name: 'Eliminar variante' }));

    await waitFor(() => {
      expect(recibidos.map((r) => `${r.metodo} ${r.ruta}`)).toEqual(['DELETE variante']);
    });
  });

  it('si los atributos no cargan, lo dice con Reintentar en lugar de dejar el formulario sin opciones', async () => {
    preparar();
    servidor.use(
      http.get('/api/v1/admin/atributos', () =>
        HttpResponse.json(
          { error: { codigo: 'ERROR_INTERNO', mensaje: 'Algo salió mal.', requestId: 'r' } },
          { status: 500 },
        ),
      ),
    );
    abrir();

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('No pudimos cargar los atributos.');
    expect(within(aviso).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('agregar una variante: SKU, un valor por atributo y el precio inicial', async () => {
    const recibidos = preparar();
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Agregar variante' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Agregar variante' }));
    await usuario.type(dialogo.getByLabelText('SKU'), 'CAM-OXF-BL-M');
    await usuario.selectOptions(dialogo.getByLabelText('Talla'), 'M');
    await usuario.selectOptions(dialogo.getByLabelText('Color'), 'Blanco');
    await usuario.type(dialogo.getByLabelText('Precio inicial'), '259.90');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar variante' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(recibidos).toEqual([
      {
        metodo: 'POST',
        ruta: 'variantes',
        cuerpo: { sku: 'CAM-OXF-BL-M', valores: [12, 22], precio: '259.90' },
      },
    ]);
  });

  it('un SKU repetido (409 SKU_DUPLICADO) marca el campo SKU', async () => {
    preparar({
      'POST variantes': { status: 409, codigo: 'SKU_DUPLICADO', mensaje: 'El SKU ya existe.' },
    });
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Agregar variante' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Agregar variante' }));
    await usuario.type(dialogo.getByLabelText('SKU'), 'CAM-OXF-AZ-M');
    await usuario.type(dialogo.getByLabelText('Precio inicial'), '249.00');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar variante' }));

    await waitFor(() => {
      expect(dialogo.getByLabelText('SKU')).toHaveAccessibleDescription('El SKU ya existe.');
    });
  });

  it('una combinación repetida (409 COMBINACION_DUPLICADA) llega al aviso del formulario', async () => {
    preparar({
      'POST variantes': {
        status: 409,
        codigo: 'COMBINACION_DUPLICADA',
        mensaje: 'Ya existe una variante con esa combinación de atributos.',
      },
    });
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Agregar variante' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Agregar variante' }));
    await usuario.type(dialogo.getByLabelText('SKU'), 'OTRO-SKU');
    await usuario.type(dialogo.getByLabelText('Precio inicial'), '249.00');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar variante' }));

    expect(await dialogo.findByRole('alert')).toHaveTextContent(
      'Ya existe una variante con esa combinación de atributos.',
    );
  });

  it('activar una variante espera al backend', async () => {
    const recibidos = preparar();
    const { usuario } = abrir();

    await usuario.click((await variantes()).getByRole('button', { name: 'Activar CAM-OXF-BL-S' }));

    await waitFor(() => {
      expect(recibidos).toEqual([{ metodo: 'POST', ruta: 'variante activar' }]);
    });
  });

  it('agregar una imagen guarda la lista completa', async () => {
    const recibidos = preparar();
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Agregar imagen' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Agregar imagen' }));
    await usuario.type(dialogo.getByLabelText('URL'), '/static/productos/oxford-2.svg');
    await usuario.type(dialogo.getByLabelText('Texto alternativo'), 'Camisa Oxford de espalda');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar imagen' }));

    await waitFor(() => {
      expect(recibidos[0]).toEqual({
        metodo: 'PUT',
        ruta: 'imagenes',
        cuerpo: {
          imagenes: [
            {
              url: '/static/productos/camisas.svg',
              textoAlternativo: 'Camisa Oxford',
              orden: 1,
              esPrincipal: true,
            },
            {
              url: '/static/productos/oxford-2.svg',
              textoAlternativo: 'Camisa Oxford de espalda',
              orden: 2,
              esPrincipal: false,
            },
          ],
        },
      });
    });
  });

  it('un producto que no existe dice «No encontramos este producto»', async () => {
    simularCatalogoAdmin([], []);
    simularProductoAdmin(null);
    abrir();

    expect(
      await screen.findByRole('heading', { name: 'No encontramos este producto' }),
    ).toBeInTheDocument();
  });
});
