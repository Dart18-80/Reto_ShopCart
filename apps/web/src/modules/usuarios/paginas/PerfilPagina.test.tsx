import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  perfilDePrueba,
  simularActualizarPerfil,
  simularCambioDeContrasena,
  simularContrasenaActualIncorrecta,
  simularPerfil,
  simularPerfilFallido,
} from '../../../test/handlers/usuarios';
import { renderizarRutas } from '../../../test/renderizar';
import { tokenDeLaSesion } from '../../../test/sesion';

const RUTA = '/cuenta/perfil';
const seccion = (titulo: string) => screen.getByRole('region', { name: titulo });

describe('PerfilPagina (M1-H02)', () => {
  it('mientras carga muestra el esqueleto y después los datos del perfil', async () => {
    simularPerfil(perfilDePrueba('Cliente'), 50);
    renderizarRutas(crearRutas(), { ruta: RUTA, rol: 'Cliente' });

    expect(await screen.findByRole('heading', { name: 'Mi perfil', level: 1 })).toBeInTheDocument();
    expect(within(seccion('Tus datos')).queryByLabelText('Nombre')).not.toBeInTheDocument();

    expect(await screen.findByLabelText('Nombre')).toHaveValue('Ana Cliente');
    expect(screen.getByLabelText('Teléfono (opcional)')).toHaveValue('55551234');
    expect(within(seccion('Tus datos')).getByText('cliente@prueba.gt')).toBeInTheDocument();
  });

  it('si el perfil no carga, muestra el error del backend con Reintentar; la contraseña sigue disponible', async () => {
    simularPerfilFallido(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado.');
    renderizarRutas(crearRutas(), { ruta: RUTA, rol: 'Cliente' });

    const datos = await screen.findByRole('region', { name: 'Tus datos' });
    expect(await within(datos).findByText('Ocurrió un error inesperado.')).toBeInTheDocument();
    expect(within(datos).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    expect(within(seccion('Contraseña')).getByLabelText('Contraseña actual')).toBeInTheDocument();
  });

  it('guardar envía nombre y teléfono, y la página muestra lo que respondió el backend', async () => {
    const cuerpos = simularActualizarPerfil(perfilDePrueba('Cliente'));
    const { usuario } = renderizarRutas(crearRutas(), { ruta: RUTA, rol: 'Cliente' });

    const nombre = await screen.findByLabelText('Nombre');
    await usuario.clear(nombre);
    await usuario.type(nombre, 'Ana María Cliente');
    await usuario.click(screen.getByRole('button', { name: 'Guardar datos' }));

    expect(await screen.findByText('Tus datos se guardaron.')).toBeInTheDocument();
    expect(cuerpos).toEqual([{ nombre: 'Ana María Cliente', telefono: '55551234' }]);
  });

  it('guardar el perfil actualiza el nombre del menú de la cuenta sin recargar', async () => {
    simularActualizarPerfil(perfilDePrueba('Cliente'));
    const { usuario } = renderizarRutas(crearRutas(), { ruta: RUTA, rol: 'Cliente' });
    const menuCuenta = await screen.findByRole('complementary', { name: 'Tu cuenta' });
    expect(within(menuCuenta).getByText('Ana Cliente')).toBeInTheDocument();

    const nombre = await screen.findByLabelText('Nombre');
    await usuario.clear(nombre);
    await usuario.type(nombre, 'Ana María Cliente');
    await usuario.click(screen.getByRole('button', { name: 'Guardar datos' }));

    expect(await within(menuCuenta).findByText('Ana María Cliente')).toBeInTheDocument();
    expect(within(menuCuenta).getByText('cliente@prueba.gt')).toBeInTheDocument();
  });

  it('borrar el teléfono lo quita: se envía null', async () => {
    const cuerpos = simularActualizarPerfil(perfilDePrueba('Cliente'));
    const { usuario } = renderizarRutas(crearRutas(), { ruta: RUTA, rol: 'Cliente' });

    await usuario.clear(await screen.findByLabelText('Teléfono (opcional)'));
    await usuario.click(screen.getByRole('button', { name: 'Guardar datos' }));

    await waitFor(() => {
      expect(cuerpos).toEqual([{ nombre: 'Ana Cliente', telefono: null }]);
    });
  });

  it('una contraseña actual incorrecta marca el campo contrasenaActual con el mensaje del backend', async () => {
    simularPerfil();
    simularContrasenaActualIncorrecta();
    const { usuario } = renderizarRutas(crearRutas(), { ruta: RUTA, rol: 'Cliente' });

    await usuario.type(await screen.findByLabelText('Contraseña actual'), 'NoEsLaMia2026');
    await usuario.type(screen.getByLabelText('Contraseña nueva'), 'NuevaClave2027');
    await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(await screen.findByLabelText('Contraseña actual')).toHaveAccessibleDescription(
      'La contraseña actual no es correcta.',
    );
    expect(within(seccion('Contraseña')).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('una contraseña nueva sin números se rechaza en el navegador con el mensaje del backend', async () => {
    simularPerfil();
    const cuerpos = simularCambioDeContrasena();
    const { usuario } = renderizarRutas(crearRutas(), { ruta: RUTA, rol: 'Cliente' });

    await usuario.type(await screen.findByLabelText('Contraseña actual'), 'Secreta2026');
    await usuario.type(screen.getByLabelText('Contraseña nueva'), 'SoloLetras');
    await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    expect(await screen.findByLabelText('Contraseña nueva')).toHaveAccessibleDescription(
      'Debe incluir al menos un número.',
    );
    expect(cuerpos).toHaveLength(0);
  });

  it('cambiar la contraseña adopta la sesión nueva que devuelve el backend y vacía el formulario (A-07)', async () => {
    simularPerfil();
    const cuerpos = simularCambioDeContrasena();
    const { usuario } = renderizarRutas(crearRutas(), { ruta: RUTA, rol: 'Cliente' });

    await usuario.type(await screen.findByLabelText('Contraseña actual'), 'Secreta2026');
    await usuario.type(screen.getByLabelText('Contraseña nueva'), 'NuevaClave2027');
    await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));

    await waitFor(() => {
      expect(tokenDeLaSesion()).toBe('token-tras-cambiar');
    });
    expect(cuerpos).toEqual([
      { contrasenaActual: 'Secreta2026', contrasenaNueva: 'NuevaClave2027' },
    ]);
    expect(screen.getByLabelText('Contraseña actual')).toHaveValue('');
    expect(await screen.findByText(/Contraseña actualizada/)).toBeInTheDocument();
  });
});
