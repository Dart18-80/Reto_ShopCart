import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  atributoDePrueba,
  categoriaAdminDePrueba,
  simularCatalogoAdmin,
} from '../../../test/handlers/catalogo-admin';
import { renderizarRutas } from '../../../test/renderizar';
import { servidor } from '../../../test/servidor';

const abrir = () =>
  renderizarRutas(crearRutas(), { ruta: '/backoffice/catalogo/categorias', rol: 'Administrador' });

const CAMISAS = categoriaAdminDePrueba();
const GORRAS = categoriaAdminDePrueba({
  idCategoria: 2,
  nombre: 'Gorras',
  ilustracion: 'Gorra',
  activo: false,
  productos: 0,
});

const fila = async (nombre: string) =>
  within(
    (await screen.findAllByText(nombre))
      .map((celda) => celda.closest('tr') ?? celda.closest('li'))
      .find((contenedor) => contenedor !== null) ?? document.body,
  );

describe('CategoriasPagina (M6-H02)', () => {
  it('lista todas las categorías, también las inactivas, con su ilustración, productos y estado', async () => {
    simularCatalogoAdmin([CAMISAS, GORRAS]);
    abrir();

    const camisas = await fila('Camisas y blusas');
    expect(camisas.getByRole('img', { name: 'Camisa' })).toBeInTheDocument();
    expect(camisas.getByText('12')).toBeInTheDocument();
    expect(camisas.getByText('Activa')).toBeInTheDocument();
    const gorras = await fila('Gorras');
    expect(gorras.getByText('Inactiva')).toBeInTheDocument();
    expect(gorras.getByRole('button', { name: 'Activar Gorras' })).toBeInTheDocument();
  });

  it('una categoría desactivada se reactiva y la lista lo muestra cuando lo confirma el backend', async () => {
    const recibidos = simularCatalogoAdmin([CAMISAS, GORRAS]);
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Activar Gorras' }));

    await waitFor(async () => {
      expect((await fila('Gorras')).getByText('Activa')).toBeInTheDocument();
    });
    expect(recibidos).toEqual([{ metodo: 'POST', ruta: 'activar' }]);
  });

  it('desactivar una categoría con productos activos muestra el mensaje del backend', async () => {
    simularCatalogoAdmin([CAMISAS], [], {
      'POST desactivar': {
        status: 409,
        codigo: 'CATEGORIA_CON_PRODUCTOS',
        mensaje: 'La categoría tiene productos activos: desactívalos o muévelos antes.',
      },
    });
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Desactivar Camisas y blusas' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La categoría tiene productos activos: desactívalos o muévelos antes.',
    );
  });

  it('crear una categoría con su ilustración: la descripción vacía no se envía', async () => {
    const recibidos = simularCatalogoAdmin([CAMISAS]);
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Nueva categoría' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Nueva categoría' }));
    await usuario.type(dialogo.getByLabelText('Nombre'), 'Pantalones');
    await usuario.click(dialogo.getByRole('radio', { name: 'Pantalón' }));
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar categoría' }));

    expect(await fila('Pantalones')).toBeTruthy();
    expect(recibidos).toEqual([
      { metodo: 'POST', ruta: 'crear', cuerpo: { nombre: 'Pantalones', ilustracion: 'Pantalon' } },
    ]);
  });

  it('editar trae los datos guardados y envía lo que se cambió', async () => {
    const recibidos = simularCatalogoAdmin([CAMISAS]);
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Editar Camisas y blusas' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Editar categoría' }));
    expect(dialogo.getByLabelText('Nombre')).toHaveValue('Camisas y blusas');
    expect(dialogo.getByRole('radio', { name: 'Camisa' })).toBeChecked();
    await usuario.click(dialogo.getByRole('radio', { name: 'Chaqueta' }));
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(recibidos[0]).toMatchObject({ metodo: 'PATCH', cuerpo: { ilustracion: 'Chaqueta' } });
  });

  it('eliminar una categoría con productos muestra el mensaje del backend', async () => {
    simularCatalogoAdmin([CAMISAS], [], {
      'DELETE eliminar': {
        status: 409,
        codigo: 'CATEGORIA_CON_PRODUCTOS',
        mensaje: 'La categoría tiene productos: solo se puede desactivar.',
      },
    });
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Eliminar Camisas y blusas' }));
    const confirmacion = within(
      await screen.findByRole('alertdialog', { name: '¿Eliminar Camisas y blusas?' }),
    );
    await usuario.click(confirmacion.getByRole('button', { name: 'Eliminar categoría' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La categoría tiene productos: solo se puede desactivar.',
    );
  });

  it('los atributos con sus valores en orden; crear un atributo y agregarle un valor', async () => {
    const recibidos = simularCatalogoAdmin([CAMISAS], [atributoDePrueba()]);
    const { usuario } = abrir();

    const talla = within(await screen.findByRole('region', { name: 'Talla' }));
    expect(talla.getAllByRole('listitem').map((v) => v.textContent)).toEqual(['S', 'M']);
    await usuario.type(talla.getByLabelText('Valor nuevo'), 'L');
    await usuario.click(talla.getByRole('button', { name: 'Agregar' }));
    await waitFor(() => {
      expect(talla.getAllByRole('listitem').map((v) => v.textContent)).toEqual(['S', 'M', 'L']);
    });

    await usuario.click(screen.getByRole('button', { name: 'Nuevo atributo' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Nuevo atributo' }));
    await usuario.type(dialogo.getByLabelText('Nombre'), 'Material');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar atributo' }));

    expect(await screen.findByRole('region', { name: 'Material' })).toBeInTheDocument();
    expect(recibidos.map((r) => r.ruta)).toEqual(['valor', 'atributo']);
  });

  it('un valor repetido muestra el mensaje del backend en su formulario', async () => {
    simularCatalogoAdmin([CAMISAS], [atributoDePrueba()], {
      'POST valor': {
        status: 409,
        codigo: 'NOMBRE_DUPLICADO',
        mensaje: 'El atributo ya tiene ese valor.',
      },
    });
    const { usuario } = abrir();

    const talla = within(await screen.findByRole('region', { name: 'Talla' }));
    await usuario.type(talla.getByLabelText('Valor nuevo'), 'M');
    await usuario.click(talla.getByRole('button', { name: 'Agregar' }));

    expect(await talla.findByRole('alert')).toHaveTextContent('El atributo ya tiene ese valor.');
  });

  it('si las categorías no cargan, muestra el error con Reintentar', async () => {
    simularCatalogoAdmin([], [atributoDePrueba()]);
    servidor.use(
      http.get('/api/v1/admin/categorias', () =>
        HttpResponse.json(
          {
            error: {
              codigo: 'ERROR_INTERNO',
              mensaje: 'No pudimos cargar las categorías.',
              requestId: 'r',
            },
          },
          { status: 500 },
        ),
      ),
    );
    abrir();

    expect(await screen.findByText('No pudimos cargar las categorías.')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Reintentar' }).length).toBeGreaterThan(0);
  });
});
