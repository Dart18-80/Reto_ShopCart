import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import { configuracionDePrueba, simularConfiguracion } from '../../../test/handlers/administracion';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = (rol: 'Administrador' | 'Operador' = 'Administrador') =>
  renderizarRutas(crearRutas(), { ruta: '/backoffice/configuracion', rol });

describe('ConfiguracionPagina (M9-H02)', () => {
  it('muestra cada parámetro con su valor, para qué sirve y su rango', async () => {
    simularConfiguracion(configuracionDePrueba());
    abrir();

    expect(await screen.findByLabelText('Minutos de reserva al pagar')).toHaveValue('15');
    expect(
      screen.getByText('Lo que dura apartado un carrito mientras se paga. Entre 5 y 60.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Envío gratis desde')).toHaveValue('500.00');
    expect(screen.getByText('Última actualización: 5 nov 2026, 12:05.')).toBeInTheDocument();
  });

  it('guardar envía los números como enteros y el envío gratis vacío como null', async () => {
    const { recibidos } = simularConfiguracion(configuracionDePrueba());
    const { usuario } = abrir();

    const minutos = await screen.findByLabelText('Minutos de reserva al pagar');
    await usuario.clear(minutos);
    await usuario.type(minutos, '20');
    await usuario.clear(screen.getByLabelText('Envío gratis desde'));
    await usuario.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    expect(await screen.findByText('Guardamos la configuración.')).toBeInTheDocument();
    expect(recibidos).toEqual([
      expect.objectContaining({
        minutosReserva: 20,
        diasGarantiaPrecio: 3,
        montoEnvioGratis: null,
      }),
    ]);
    await waitFor(() => {
      expect(screen.getByLabelText('Envío gratis desde')).toHaveValue('');
    });
  });

  it('un valor fuera de su rango lo marca el mismo esquema que la API, en español', async () => {
    const { recibidos } = simularConfiguracion(configuracionDePrueba());
    const { usuario } = abrir();

    const minutos = await screen.findByLabelText('Minutos de reserva al pagar');
    await usuario.clear(minutos);
    await usuario.type(minutos, '90');
    await usuario.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    expect(await screen.findByText('No puede pasar de 60.')).toBeInTheDocument();
    expect(recibidos).toEqual([]);
  });

  it('al guardar toma la configuración de la respuesta: no la vuelve a pedir', async () => {
    const { lecturas } = simularConfiguracion(configuracionDePrueba());
    const { usuario } = abrir();

    const minutos = await screen.findByLabelText('Minutos de reserva al pagar');
    await usuario.clear(minutos);
    await usuario.type(minutos, '20');
    await usuario.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    expect(await screen.findByText('Guardamos la configuración.')).toBeInTheDocument();
    expect(screen.getByText('Última actualización: 8 nov 2026, 04:00.')).toBeInTheDocument();
    expect(lecturas.total).toBe(1);
  });

  it('un Operador ve «Sin permiso»', async () => {
    abrir('Operador');

    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });
});
