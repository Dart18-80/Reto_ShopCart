import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import { simularUsuariosAdmin, usuarioAdminDePrueba } from '../../../test/handlers/usuarios';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = (rol: 'Administrador' | 'Operador' = 'Administrador') =>
  renderizarRutas(crearRutas(), { ruta: '/backoffice/usuarios', rol });

const OPERADORA = usuarioAdminDePrueba();
const ADMIN = usuarioAdminDePrueba({
  idUsuario: 1,
  correo: 'admin@shopcart.gt',
  nombre: 'Ana Admin',
  rol: 'Administrador',
});
const INACTIVO = usuarioAdminDePrueba({
  idUsuario: 30,
  correo: 'pedro@correo.gt',
  nombre: 'Pedro Cliente',
  rol: 'Cliente',
  activo: false,
  fechaCreacion: '2026-11-05T05:30:00.000Z',
});

const fila = async (nombre: string) =>
  within((await screen.findByText(nombre)).closest('tr') ?? document.body);

describe('UsuariosPagina (M10-H01)', () => {
  it('la tabla: nombre, correo, rol, estado y el día de creación en Guatemala', async () => {
    simularUsuariosAdmin([OPERADORA, ADMIN, INACTIVO]);
    abrir();

    const pedro = await fila('Pedro Cliente');
    expect(pedro.getByText('pedro@correo.gt')).toBeInTheDocument();
    expect(pedro.getByText('Cliente')).toBeInTheDocument();
    expect(pedro.getByText('Inactivo')).toBeInTheDocument();
    // 05:30 UTC del 5 de noviembre todavía es el 4 en Guatemala.
    expect(pedro.getByText('4 nov 2026')).toBeInTheDocument();
    expect(pedro.getByRole('button', { name: 'Activar a Pedro Cliente' })).toBeInTheDocument();
  });

  it('filtrar por rol y estado, y ordenar por nombre, van en la URL y al servidor', async () => {
    const { consultas } = simularUsuariosAdmin([OPERADORA]);
    const { usuario, router } = abrir();

    await usuario.selectOptions(await screen.findByLabelText('Rol'), 'Operador');
    await usuario.selectOptions(screen.getByLabelText('Estado'), 'Activos');
    const tabla = within(screen.getByRole('table', { name: 'Usuarios' }));
    await usuario.click(tabla.getByRole('button', { name: /Nombre/ }));

    await waitFor(() => {
      expect(Object.fromEntries(consultas.at(-1) ?? [])).toMatchObject({
        rol: 'Operador',
        activo: 'true',
        orden: 'nombre',
      });
    });
    expect(router.state.location.search).toContain('rol=Operador');
  });

  it('crear un Operador con su contraseña inicial; un correo en uso marca el campo', async () => {
    const { recibidos } = simularUsuariosAdmin([OPERADORA], {
      'POST crear': {
        status: 409,
        codigo: 'CORREO_EN_USO',
        mensaje: 'El correo ya está registrado.',
      },
    });
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Nuevo usuario' }));
    const dialogo = within(screen.getByRole('dialog', { name: 'Nuevo usuario' }));
    await usuario.type(dialogo.getByLabelText('Nombre'), 'Óscar');
    await usuario.type(dialogo.getByLabelText('Correo'), 'oscar@shopcart.gt');
    await usuario.type(dialogo.getByLabelText('Contraseña inicial'), 'Inicial2026!');
    await usuario.click(dialogo.getByRole('button', { name: 'Crear usuario' }));

    expect(await dialogo.findByText('El correo ya está registrado.')).toBeInTheDocument();
    expect(recibidos).toEqual([
      {
        metodo: 'POST',
        ruta: 'crear',
        cuerpo: {
          nombre: 'Óscar',
          correo: 'oscar@shopcart.gt',
          contrasena: 'Inicial2026!',
          rol: 'Operador',
        },
      },
    ]);
  });

  it('cambiar el propio rol (409 ACCION_SOBRE_SI_MISMO) muestra el mensaje del backend', async () => {
    simularUsuariosAdmin([ADMIN], {
      'PATCH editar': {
        status: 409,
        codigo: 'ACCION_SOBRE_SI_MISMO',
        mensaje: 'No puedes cambiar tu propio rol.',
      },
    });
    const { usuario } = abrir();

    await usuario.click(
      (await fila('Ana Admin')).getByRole('button', { name: 'Editar a Ana Admin' }),
    );
    const dialogo = within(screen.getByRole('dialog'));
    await usuario.selectOptions(dialogo.getByLabelText('Rol'), 'Operador');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar cambios' }));

    expect(await dialogo.findByRole('alert')).toHaveTextContent('No puedes cambiar tu propio rol.');
  });

  it('desactivar pide confirmación; el último Admin (409 ULTIMO_ADMIN) muestra el mensaje del backend', async () => {
    const { recibidos } = simularUsuariosAdmin([ADMIN], {
      'POST desactivar': {
        status: 409,
        codigo: 'ULTIMO_ADMIN',
        mensaje: 'El sistema debe conservar al menos un administrador activo.',
      },
    });
    const { usuario } = abrir();

    await usuario.click(
      (await fila('Ana Admin')).getByRole('button', { name: 'Desactivar a Ana Admin' }),
    );
    const confirmacion = within(
      screen.getByRole('alertdialog', { name: '¿Desactivar a Ana Admin?' }),
    );
    expect(recibidos).toEqual([]);
    await usuario.click(confirmacion.getByRole('button', { name: 'Desactivar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El sistema debe conservar al menos un administrador activo.',
    );
    expect(recibidos).toEqual([{ metodo: 'POST', ruta: 'desactivar' }]);
  });

  it('activar no pide confirmación y la lista muestra lo que confirmó el backend', async () => {
    simularUsuariosAdmin([INACTIVO]);
    const { usuario } = abrir();

    await usuario.click(
      (await fila('Pedro Cliente')).getByRole('button', { name: 'Activar a Pedro Cliente' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Desactivar a Pedro Cliente' }),
    ).toBeInTheDocument();
  });

  it('un Operador ve «Sin permiso»', async () => {
    abrir('Operador');

    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });
});
