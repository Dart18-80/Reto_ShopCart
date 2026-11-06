import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  descuadreDePrueba,
  existenciaDePrueba,
  simularConciliacion,
  simularExistencias,
} from '../../../test/handlers/inventario';
import { renderizarRutas } from '../../../test/renderizar';

const abrir = (ruta = '/backoffice/inventario') =>
  renderizarRutas(crearRutas(), { ruta, rol: 'Operador' });

const AGOTADA = existenciaDePrueba({
  idVariante: 61,
  sku: 'TEN-URB-RO-42',
  producto: 'Tenis urbanos de lona',
  descripcionAtributos: 'Rojo / 42',
  existenciaFisica: 1,
  reservado: 1,
  disponible: 0,
});

function preparar() {
  simularConciliacion();
  return simularExistencias([AGOTADA, existenciaDePrueba()]);
}

const tabla = () => screen.findByRole('table', { name: 'Existencias' });
const filaDe = (contenedor: HTMLElement, sku: string) =>
  within(within(contenedor).getByText(sku).closest('tr') ?? document.body);

describe('InventarioPagina, existencias (M7-H01)', () => {
  it('un Operador ve SKU, producto y variante, física, reservado y disponible', async () => {
    preparar();
    abrir();

    const fila = filaDe(await tabla(), 'CAM-OXF-AZ-M');
    expect(fila.getByText('Camisa Oxford, Azul / M')).toBeInTheDocument();
    expect(fila.getByText('24')).toBeInTheDocument();
    expect(fila.getByText('2')).toBeInTheDocument();
    expect(fila.getByText('22')).toBeInTheDocument();
  });

  it('el disponible en 0 va en el color de oferta', async () => {
    preparar();
    abrir();

    const fila = filaDe(await tabla(), 'TEN-URB-RO-42');
    expect(fila.getByText('0')).toHaveClass('text-oferta');
  });

  it('por defecto pide lo menos disponible primero, y «Ordenar por» cambia la URL y la consulta', async () => {
    const consultas = preparar();
    const { usuario, router } = abrir();

    await tabla();
    expect(consultas.at(-1)?.get('orden')).toBe('disponible');
    expect(consultas.at(-1)?.get('direccion')).toBe('asc');
    expect(screen.getByLabelText('Ordenar por')).toHaveDisplayValue('Menor disponible');

    await usuario.selectOptions(screen.getByLabelText('Ordenar por'), 'SKU');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?orden=sku');
    });
    await waitFor(() => {
      expect(consultas.at(-1)?.get('orden')).toBe('sku');
    });
  });

  it('buscar por SKU o producto viaja al servidor como texto', async () => {
    const consultas = preparar();
    const { usuario, router } = abrir();

    await usuario.type(await screen.findByLabelText('Buscar'), 'camison');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?texto=camison');
    });
    await waitFor(() => {
      expect(consultas.at(-1)?.get('texto')).toBe('camison');
    });
  });

  it('sin descuadres, la conciliación lo dice en verde', async () => {
    preparar();
    abrir();

    expect(
      await screen.findByText('La existencia coincide con el kardex en todas las variantes.'),
    ).toBeInTheDocument();
  });

  it('con descuadres, la conciliación los lista con la física y la suma del kardex', async () => {
    simularExistencias([existenciaDePrueba()]);
    simularConciliacion([descuadreDePrueba()]);
    abrir();

    const aviso = await screen.findByRole('alert');
    expect(aviso).toHaveTextContent('1 variante no coincide con su kardex');
    expect(within(aviso).getByText(/CAM-OXF-AZ-M/)).toHaveTextContent(
      'CAM-OXF-AZ-M: física 24, kardex 23',
    );
  });
});
