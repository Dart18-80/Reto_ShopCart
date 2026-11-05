import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import { direccionDePrueba, simularLibretaDeDirecciones } from '../../../test/handlers/direcciones';
import { renderizarRutas } from '../../../test/renderizar';
import { servidor } from '../../../test/servidor';

type Usuario = ReturnType<typeof renderizarRutas>['usuario'];

const abrir = () => renderizarRutas(crearRutas(), { ruta: '/cuenta/direcciones', rol: 'Cliente' });
const tarjeta = (titulo: string) =>
  screen.getByRole('heading', { name: titulo }).closest('li') ?? document.body;

const CASA = direccionDePrueba({ idDireccion: 1, alias: 'Casa', esPredeterminada: true });
const OFICINA = direccionDePrueba({ idDireccion: 2, alias: 'Oficina', esPredeterminada: false });

async function llenarNueva(usuario: Usuario) {
  const dialogo = within(await screen.findByRole('dialog', { name: 'Nueva dirección' }));
  await usuario.type(dialogo.getByLabelText('Quién recibe'), 'Ana Pérez');
  await usuario.type(dialogo.getByLabelText('Teléfono'), '55551234');
  await usuario.type(dialogo.getByLabelText('Dirección'), '5a avenida 10-20, zona 1');
  return dialogo;
}

describe('DireccionesPagina (M4-H01)', () => {
  it('lista las direcciones con la predeterminada marcada', async () => {
    simularLibretaDeDirecciones([CASA, OFICINA]);
    abrir();

    await screen.findByRole('heading', { name: 'Casa' });
    expect(within(tarjeta('Casa')).getByText('Predeterminada')).toBeInTheDocument();
    expect(within(tarjeta('Oficina')).queryByText('Predeterminada')).not.toBeInTheDocument();
  });

  it('marcar una como predeterminada desmarca la anterior, cuando lo confirma el backend', async () => {
    const recibidos = simularLibretaDeDirecciones([CASA, OFICINA]);
    const { usuario } = abrir();

    await usuario.click(
      within(await screen.findByRole('list', { name: 'Direcciones' })).getByRole('button', {
        name: 'Usar como predeterminada',
      }),
    );

    await waitFor(() => {
      expect(within(tarjeta('Oficina')).getByText('Predeterminada')).toBeInTheDocument();
    });
    expect(within(tarjeta('Casa')).queryByText('Predeterminada')).not.toBeInTheDocument();
    expect(recibidos).toEqual([{ metodo: 'PATCH', cuerpo: { esPredeterminada: true } }]);
  });

  it('crear una dirección: el municipio se carga al elegir el departamento', async () => {
    const recibidos = simularLibretaDeDirecciones([]);
    const { usuario } = abrir();
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));
    const dialogo = await llenarNueva(usuario);

    await usuario.selectOptions(dialogo.getByLabelText('Departamento'), 'Sacatepéquez');
    await usuario.selectOptions(
      await dialogo.findByRole('combobox', { name: 'Municipio' }),
      'Antigua Guatemala',
    );
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar dirección' }));

    expect(await screen.findByRole('heading', { name: 'Ana Pérez' })).toBeInTheDocument();
    expect(recibidos).toEqual([
      {
        metodo: 'POST',
        cuerpo: {
          nombreRecibe: 'Ana Pérez',
          telefonoRecibe: '55551234',
          idMunicipio: 201,
          direccionLinea: '5a avenida 10-20, zona 1',
          esPredeterminada: false,
        },
      },
    ]);
  });

  it('cambiar el departamento limpia el municipio elegido', async () => {
    simularLibretaDeDirecciones([]);
    const { usuario } = abrir();
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));
    const dialogo = await llenarNueva(usuario);

    await usuario.selectOptions(dialogo.getByLabelText('Departamento'), 'Guatemala');
    const municipio = await dialogo.findByRole('combobox', { name: 'Municipio' });
    await usuario.selectOptions(municipio, 'Mixco');
    await usuario.selectOptions(dialogo.getByLabelText('Departamento'), 'Sacatepéquez');

    expect(dialogo.getByRole('combobox', { name: 'Municipio' })).toHaveValue('');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar dirección' }));
    expect(dialogo.getByRole('combobox', { name: 'Municipio' })).toHaveAccessibleDescription(
      'Elige un municipio.',
    );
  });

  it('el máximo de direcciones (422) llega al aviso del formulario con el mensaje del backend', async () => {
    simularLibretaDeDirecciones([]);
    servidor.use(
      http.post('/api/v1/direcciones', () =>
        HttpResponse.json(
          {
            error: {
              codigo: 'LIMITE_DIRECCIONES',
              mensaje: 'Alcanzaste el máximo de 10 direcciones.',
              requestId: 'req-dir',
            },
          },
          { status: 422 },
        ),
      ),
    );
    const { usuario } = abrir();
    await usuario.click(await screen.findByRole('button', { name: 'Agregar dirección' }));
    const dialogo = await llenarNueva(usuario);
    await usuario.selectOptions(dialogo.getByLabelText('Departamento'), 'Guatemala');
    await usuario.selectOptions(
      await dialogo.findByRole('combobox', { name: 'Municipio' }),
      'Mixco',
    );

    await usuario.click(dialogo.getByRole('button', { name: 'Guardar dirección' }));

    expect(await dialogo.findByRole('alert')).toHaveTextContent(
      'Alcanzaste el máximo de 10 direcciones.',
    );
  });

  it('editar trae los datos guardados (con su departamento) y eliminar la quita', async () => {
    const recibidos = simularLibretaDeDirecciones([CASA]);
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Editar Casa' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Editar dirección' }));
    expect(dialogo.getByLabelText('Departamento')).toHaveValue('1');
    await waitFor(() => {
      expect(dialogo.getByRole('combobox', { name: 'Municipio' })).toHaveValue('101');
    });
    await usuario.clear(dialogo.getByLabelText('Quién recibe'));
    await usuario.type(dialogo.getByLabelText('Quién recibe'), 'Luis Pérez');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await usuario.click(screen.getByRole('button', { name: 'Eliminar Casa' }));

    expect(await screen.findByText('Todavía no tienes direcciones')).toBeInTheDocument();
    expect(recibidos.map((r) => r.metodo)).toEqual(['PATCH', 'DELETE']);
    expect(recibidos[0]?.cuerpo).toMatchObject({ nombreRecibe: 'Luis Pérez', idMunicipio: 101 });
  });

  it('si la lista no carga, muestra el error con Reintentar', async () => {
    servidor.use(
      http.get('/api/v1/direcciones', () =>
        HttpResponse.json(
          {
            error: {
              codigo: 'ERROR_INTERNO',
              mensaje: 'No pudimos cargar tus direcciones.',
              requestId: 'r',
            },
          },
          { status: 500 },
        ),
      ),
    );
    abrir();

    expect(await screen.findByText('No pudimos cargar tus direcciones.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
