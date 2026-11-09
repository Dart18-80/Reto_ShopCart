import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import { registroBitacoraDePrueba, simularBitacora } from '../../../test/handlers/administracion';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = (rol: 'Administrador' | 'Operador' = 'Administrador') =>
  renderizarRutas(crearRutas(), { ruta: '/backoffice/bitacora', rol });

const PRECIO = registroBitacoraDePrueba();
const DEL_SISTEMA = registroBitacoraDePrueba({
  idBitacora: '901',
  modulo: 'Pedidos',
  entidad: 'Reembolso',
  idEntidad: '12',
  accion: 'CambioEstado',
  valorAnterior: { Estado: 'Pendiente' },
  valorNuevo: { Estado: 'Completado' },
  usuario: null,
});

const fila = async (texto: string) =>
  within((await screen.findByText(texto)).closest('tr') ?? document.body);

describe('BitacoraPagina (M10-H02)', () => {
  it('cada registro con su fecha, usuario, módulo, entidad y acción; lo hecho por un proceso dice «Sistema»', async () => {
    simularBitacora([PRECIO, DEL_SISTEMA]);
    abrir();

    const precio = await fila('#77');
    expect(precio.getByText('8 nov 2026, 10:00')).toBeInTheDocument();
    expect(precio.getByText('Ana Admin')).toBeInTheDocument();
    expect(precio.getByText('Catálogo')).toBeInTheDocument();
    expect(precio.getByText('PrecioVariante')).toBeInTheDocument();
    expect(precio.getByText('Modificar')).toBeInTheDocument();
    expect((await fila('#12')).getByText('Sistema')).toBeInTheDocument();
  });

  it('la fila se expande con los cambios campo por campo, «antes → después»', async () => {
    simularBitacora([PRECIO]);
    const { usuario } = abrir();

    const precio = await fila('#77');
    await usuario.click(precio.getByText('3 cambios'));

    expect(precio.getByText('100.00 → 150.00')).toBeVisible();
    expect(precio.getByText('Precio')).toBeVisible();
    expect(precio.getByText('— → 2026-11-08T10:00:00')).toBeVisible();
  });

  it('filtrar por módulo, entidad y rango va en la URL y al servidor', async () => {
    const consultas = simularBitacora([PRECIO]);
    const { usuario, router } = abrir();

    await usuario.selectOptions(await screen.findByLabelText('Módulo'), 'Catálogo');
    await usuario.type(screen.getByLabelText('Entidad'), 'PrecioVariante');
    await usuario.type(screen.getByLabelText('Desde'), '2026-11-01');

    await waitFor(() => {
      expect(Object.fromEntries(consultas.at(-1) ?? [])).toMatchObject({
        modulo: 'Catalogo',
        entidad: 'PrecioVariante',
        desde: '2026-11-01',
      });
    });
    expect(router.state.location.search).toContain('modulo=Catalogo');
  });

  it('un Operador ve «Sin permiso»', async () => {
    abrir('Operador');

    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeInTheDocument();
  });
});
