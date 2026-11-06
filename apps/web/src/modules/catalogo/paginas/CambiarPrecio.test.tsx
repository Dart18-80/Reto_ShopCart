import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  productoAdminDePrueba,
  simularCatalogoAdmin,
  simularPreciosVariante,
  simularProductoAdmin,
} from '../../../test/handlers/catalogo-admin';
import { renderizarRutas } from '../../../test/renderizar';

// El 1 de octubre en Guatemala; el cambio cae el 5 de noviembre a media mañana.
const VIGENTE = {
  idPrecioVariante: 2,
  precio: '249.00',
  usuario: { idUsuario: 1, nombre: 'Administrador Demo' },
  vigenteDesde: '2026-10-01T15:00:00.000Z',
  vigenteHasta: null,
};
const ANTERIOR = {
  idPrecioVariante: 1,
  precio: '229.00',
  usuario: { idUsuario: 1, nombre: 'Administrador Demo' },
  vigenteDesde: '2026-08-15T15:00:00.000Z',
  vigenteHasta: '2026-10-01T15:00:00.000Z',
};

async function abrirDialogo() {
  simularCatalogoAdmin([], []);
  simularProductoAdmin(productoAdminDePrueba());
  const recibidos = simularPreciosVariante([VIGENTE, ANTERIOR], '2026-11-05T16:00:00.000Z');
  const pantalla = renderizarRutas(crearRutas(), {
    ruta: '/backoffice/catalogo/productos/5',
    rol: 'Administrador',
  });
  await pantalla.usuario.click(
    await screen.findByRole('button', { name: 'Cambiar precio de CAM-OXF-AZ-M' }),
  );
  const dialogo = within(
    await screen.findByRole('dialog', { name: 'Cambiar precio de CAM-OXF-AZ-M' }),
  );
  return { ...pantalla, dialogo, recibidos };
}

describe('cambiar el precio de una variante (M6-H05)', () => {
  it('muestra el precio vigente y el historial con sus rangos en días de Guatemala', async () => {
    const { dialogo } = await abrirDialogo();

    expect(dialogo.getByText('Precio vigente').parentElement).toHaveTextContent('Q249.00');
    const historial = within(await dialogo.findByRole('list', { name: 'Historial de precios' }));
    const versiones = historial.getAllByRole('listitem');
    expect(versiones[0]).toHaveTextContent('Vigente desde el 1 oct 2026');
    expect(versiones[0]).toHaveTextContent('Q249.00');
    expect(versiones[1]).toHaveTextContent('15 ago 2026 al 1 oct 2026');
    expect(versiones[1]).toHaveTextContent('Q229.00');
  });

  it('el precio nuevo viaja como texto y el historial muestra la versión nueva como vigente', async () => {
    const { usuario, dialogo, recibidos } = await abrirDialogo();

    await usuario.type(dialogo.getByLabelText('Precio nuevo'), '269.00');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar precio' }));

    await waitFor(() => {
      const versiones = within(
        dialogo.getByRole('list', { name: 'Historial de precios' }),
      ).getAllByRole('listitem');
      expect(versiones[0]).toHaveTextContent('Vigente desde el 5 nov 2026');
      expect(versiones[1]).toHaveTextContent('1 oct 2026 al 5 nov 2026');
    });
    expect(recibidos).toEqual([{ precio: '269.00' }]);
  });

  it('un precio en cero no se envía: el mismo esquema que la API', async () => {
    const { usuario, dialogo, recibidos } = await abrirDialogo();

    await usuario.type(dialogo.getByLabelText('Precio nuevo'), '0.00');
    await usuario.click(dialogo.getByRole('button', { name: 'Guardar precio' }));

    expect(dialogo.getByLabelText('Precio nuevo')).toHaveAccessibleDescription(
      'El precio debe ser mayor que cero.',
    );
    expect(recibidos).toEqual([]);
  });
});
