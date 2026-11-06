import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crearRutas } from '../../../app/router';
import {
  existenciaDePrueba,
  movimientoDePrueba,
  simularAjuste,
  simularConciliacion,
  simularEntrada,
  simularExistencias,
  simularKardex,
} from '../../../test/handlers/inventario';
import { renderizarRutas } from '../../../test/renderizar';

const OXFORD = existenciaDePrueba();
const VENTA = movimientoDePrueba({
  idMovimientoKardex: 901,
  tipo: 'SalidaVenta',
  signo: -1,
  cantidad: 2,
  existenciaAnterior: 26,
  existenciaResultante: 24,
  motivo: 'Venta',
  referencia: 'SC-000041',
  idPedido: 41,
  usuario: { idUsuario: 1, nombre: 'Sistema' },
  fecha: '2026-11-03T16:42:00.000Z',
});

function preparar() {
  simularConciliacion();
  const existencias = simularExistencias([OXFORD]);
  const kardex = simularKardex([VENTA, movimientoDePrueba()]);
  return { existencias, kardex };
}

function abrir() {
  return renderizarRutas(crearRutas(), { ruta: '/backoffice/inventario', rol: 'Operador' });
}

async function abrirAjuste(usuario: ReturnType<typeof abrir>['usuario']) {
  await usuario.click(await screen.findByRole('button', { name: 'Ajustar CAM-OXF-AZ-M' }));
  return within(await screen.findByRole('dialog', { name: 'Ajustar CAM-OXF-AZ-M' }));
}

async function ajustar(
  usuario: ReturnType<typeof abrir>['usuario'],
  cantidad: string,
  motivo: string,
) {
  const dialogo = await abrirAjuste(usuario);
  await usuario.type(dialogo.getByLabelText('Cantidad'), cantidad);
  if (motivo) await usuario.type(dialogo.getByLabelText('Motivo'), motivo);
  await usuario.click(dialogo.getByRole('button', { name: 'Registrar ajuste' }));
  return dialogo;
}

describe('InventarioPagina, ajustes (M7-H02)', () => {
  it('«Ajustar» muestra la física, lo reservado y lo disponible, y el límite en la ayuda', async () => {
    preparar();
    const { usuario } = abrir();

    const dialogo = await abrirAjuste(usuario);

    const resumen = within(dialogo.getByRole('list', { name: 'Existencia' }));
    expect(resumen.getByText('Física').nextSibling).toHaveTextContent('24');
    expect(resumen.getByText('Reservado').nextSibling).toHaveTextContent('2');
    expect(resumen.getByText('Disponible').nextSibling).toHaveTextContent('22');
    expect(
      dialogo.getByText('Negativo para restar. No puede quedar por debajo de lo reservado (2).'),
    ).toBeInTheDocument();
  });

  it('un ajuste envía la variante, la cantidad con signo y el motivo, y vuelve a pedir existencias, kardex y conciliación', async () => {
    const { existencias, kardex } = preparar();
    const cuerpos = simularAjuste(
      movimientoDePrueba({ tipo: 'AjusteNegativo', signo: -1, cantidad: 3 }),
    );
    const { usuario } = abrir();
    await screen.findByRole('table', { name: 'Existencias' });
    const pedidasAntes = { existencias: existencias.length, kardex: kardex.length };

    const dialogo = await ajustar(usuario, '-3', 'Conteo físico: 3 unidades dañadas');

    await waitFor(() => {
      expect(cuerpos).toEqual([
        { idVariante: 50, cantidad: -3, motivo: 'Conteo físico: 3 unidades dañadas' },
      ]);
    });
    await waitFor(() => {
      expect(existencias.length).toBeGreaterThan(pedidasAntes.existencias);
    });
    expect(kardex.length).toBeGreaterThan(pedidasAntes.kardex);
    expect(dialogo.getByLabelText('Cantidad')).toHaveValue('');
  });

  it('por debajo de lo reservado, la cantidad muestra el máximo ajustable de detalles', async () => {
    preparar();
    simularAjuste({
      status: 422,
      codigo: 'AJUSTE_BAJO_RESERVADO',
      mensaje:
        'Hay unidades reservadas en pagos en curso: el ajuste no puede bajar de lo reservado.',
      detalles: { maximoAjustable: 22 },
    });
    const { usuario } = abrir();

    const dialogo = await ajustar(usuario, '-23', 'Conteo');

    expect(
      await dialogo.findByText(
        'Hay unidades reservadas en pagos en curso: el ajuste no puede bajar de lo reservado. Puedes restar hasta 22.',
      ),
    ).toBeInTheDocument();
    expect(dialogo.getByLabelText('Cantidad')).toHaveAttribute('aria-invalid', 'true');
  });

  it('un ajuste que deja la física en negativo muestra el mensaje del backend en la cantidad', async () => {
    preparar();
    simularAjuste({
      status: 422,
      codigo: 'AJUSTE_DEJA_NEGATIVO',
      mensaje: 'El ajuste dejaría la existencia en negativo.',
    });
    const { usuario } = abrir();

    const dialogo = await ajustar(usuario, '-30', 'Conteo');

    expect(
      await dialogo.findByText('El ajuste dejaría la existencia en negativo.'),
    ).toBeInTheDocument();
    expect(dialogo.getByLabelText('Cantidad')).toHaveAttribute('aria-invalid', 'true');
  });

  it('sin motivo, el MOTIVO_REQUERIDO del backend va en el motivo', async () => {
    preparar();
    simularAjuste({
      status: 400,
      codigo: 'MOTIVO_REQUERIDO',
      mensaje: 'El ajuste requiere un motivo.',
    });
    const { usuario } = abrir();

    const dialogo = await ajustar(usuario, '-1', '');

    expect(await dialogo.findByText('El ajuste requiere un motivo.')).toBeInTheDocument();
    expect(dialogo.getByLabelText('Motivo')).toHaveAttribute('aria-invalid', 'true');
  });

  it('una cantidad que no es un número entero se corrige antes de enviar', async () => {
    preparar();
    const cuerpos = simularAjuste(movimientoDePrueba());
    const { usuario } = abrir();

    const dialogo = await ajustar(usuario, '2.5', 'Conteo');

    expect(await dialogo.findByText('Escribe un número entero.')).toBeInTheDocument();
    expect(cuerpos).toEqual([]);
  });
});

describe('InventarioPagina, kardex (M7-H02)', () => {
  it('«Ver kardex» lista fecha, movimiento con su referencia, cantidad con signo, anterior, resultante y usuario', async () => {
    const { kardex } = preparar();
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Ver kardex de CAM-OXF-AZ-M' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Kardex de CAM-OXF-AZ-M' }));

    const tabla = within(dialogo.getByRole('table', { name: 'Kardex' }));
    const venta = within(tabla.getByText('SC-000041').closest('tr') ?? document.body);
    expect(venta.getByText('Salida por venta')).toBeInTheDocument();
    expect(venta.getByText('−2')).toHaveClass('text-oferta');
    expect(venta.getByText('26')).toBeInTheDocument();
    expect(venta.getByText('24')).toBeInTheDocument();
    expect(venta.getByText('Sistema')).toBeInTheDocument();
    expect(venta.getByText('3 nov 2026, 10:42')).toBeInTheDocument();
    const entrada = within(tabla.getByText('F-221').closest('tr') ?? document.body);
    expect(entrada.getByText('+20')).toHaveClass('text-exito');
    expect(kardex.at(-1)?.get('variante')).toBe('50');
    expect(dialogo.queryByRole('button', { name: 'Registrar ajuste' })).not.toBeInTheDocument();
  });
});

describe('InventarioPagina, entradas (M7-H02)', () => {
  it('«Registrar entrada» busca la variante y envía la cantidad, el motivo y la referencia', async () => {
    const { existencias } = preparar();
    const cuerpos = simularEntrada(movimientoDePrueba());
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Registrar entrada' }));
    await usuario.type(dialogo.getByLabelText('Buscar variante'), 'oxford');
    await waitFor(() => {
      expect(existencias.some((c) => c.get('texto') === 'oxford')).toBe(true);
    });
    await usuario.selectOptions(
      await dialogo.findByRole('combobox', { name: 'Variante' }),
      'CAM-OXF-AZ-M · Camisa Oxford, Azul / M',
    );
    await usuario.type(dialogo.getByLabelText('Cantidad'), '20');
    await usuario.type(dialogo.getByLabelText('Motivo'), 'Compra al proveedor');
    await usuario.type(dialogo.getByLabelText('Referencia'), 'F-221');
    await usuario.click(dialogo.getByRole('button', { name: 'Registrar entrada' }));

    await waitFor(() => {
      expect(cuerpos).toEqual([
        { idVariante: 50, cantidad: 20, motivo: 'Compra al proveedor', referencia: 'F-221' },
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Registrar entrada' })).not.toBeInTheDocument();
    });
  });

  it('sin elegir variante no envía', async () => {
    preparar();
    const cuerpos = simularEntrada(movimientoDePrueba());
    const { usuario } = abrir();

    await usuario.click(await screen.findByRole('button', { name: 'Registrar entrada' }));
    const dialogo = within(await screen.findByRole('dialog', { name: 'Registrar entrada' }));
    await usuario.type(dialogo.getByLabelText('Cantidad'), '20');
    await usuario.click(dialogo.getByRole('button', { name: 'Registrar entrada' }));

    expect(await dialogo.findByText('Elige una variante.')).toBeInTheDocument();
    expect(cuerpos).toEqual([]);
  });
});
