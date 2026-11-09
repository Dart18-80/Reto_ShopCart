import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import { metodoAdminDePrueba, simularMetodosAdmin } from '../../../test/handlers/administracion';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = (rol: 'Administrador' | 'Operador' = 'Administrador') =>
  renderizarRutas(crearRutas(), { ruta: '/backoffice/envios', rol });

const ESTANDAR = metodoAdminDePrueba();
const EXPRESS = metodoAdminDePrueba({
  idMetodoEnvio: 2,
  codigo: 'Express24',
  nombre: 'Express',
  costo: '75.00',
  diasMin: 1,
  diasMax: 1,
  activo: false,
});

const fila = async (nombre: string) =>
  within((await screen.findByText(nombre)).closest('tr') ?? document.body);

describe('MetodosEnvioPagina (M9-H02)', () => {
  it('lista todos los métodos, también los inactivos, con su costo, su plazo y su estado', async () => {
    simularMetodosAdmin([ESTANDAR, EXPRESS]);
    abrir();

    const estandar = await fila('Estándar');
    expect(estandar.getByText('Q35.00')).toBeInTheDocument();
    expect(estandar.getByText('3 a 5 días hábiles')).toBeInTheDocument();
    expect(estandar.getByText('Activo')).toBeInTheDocument();
    const express = await fila('Express');
    expect(express.getByText('1 día hábil')).toBeInTheDocument();
    expect(express.getByText('Inactivo')).toBeInTheDocument();
  });

  it('editar envía el método completo (PUT) con el costo como texto y reactiva uno inactivo', async () => {
    const recibidos = simularMetodosAdmin([ESTANDAR, EXPRESS]);
    const { usuario } = abrir();

    await usuario.click((await fila('Express')).getByRole('button', { name: 'Editar Express' }));
    const dialogo = within(screen.getByRole('dialog', { name: 'Editar Express' }));
    await usuario.clear(dialogo.getByLabelText('Costo'));
    await usuario.type(dialogo.getByLabelText('Costo'), '80');
    await usuario.click(dialogo.getByLabelText('Disponible en el checkout'));
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(recibidos).toEqual([
        { nombre: 'Express', costo: '80', diasMin: 1, diasMax: 1, activo: true },
      ]);
    });
    expect(await (await fila('Express')).findByText('Activo')).toBeInTheDocument();
  });

  it('días al revés los marca el mismo esquema que la API', async () => {
    const recibidos = simularMetodosAdmin([ESTANDAR]);
    const { usuario } = abrir();

    await usuario.click((await fila('Estándar')).getByRole('button', { name: 'Editar Estándar' }));
    const dialogo = within(screen.getByRole('dialog'));
    await usuario.clear(dialogo.getByLabelText('Días máximos'));
    await usuario.type(dialogo.getByLabelText('Días máximos'), '2');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar cambios' }));

    expect(
      await dialogo.findByText('Los días máximos no pueden ser menos que los mínimos.'),
    ).toBeInTheDocument();
    expect(recibidos).toEqual([]);
  });

  it('desactivar el último activo (409) muestra el mensaje del backend', async () => {
    simularMetodosAdmin([ESTANDAR], {
      status: 409,
      codigo: 'METODO_ENVIO_ULTIMO_ACTIVO',
      mensaje: 'Debe quedar al menos un método de envío activo.',
    });
    const { usuario } = abrir();

    await usuario.click((await fila('Estándar')).getByRole('button', { name: 'Editar Estándar' }));
    const dialogo = within(screen.getByRole('dialog'));
    await usuario.click(dialogo.getByLabelText('Disponible en el checkout'));
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar cambios' }));

    expect(await dialogo.findByRole('alert')).toHaveTextContent(
      'Debe quedar al menos un método de envío activo.',
    );
  });

  it('un Operador ve «Sin permiso»', async () => {
    abrir('Operador');

    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });
});
