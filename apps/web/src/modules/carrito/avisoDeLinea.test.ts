import { describe, expect, it } from 'vitest';
import type { LineaCarrito } from './carrito.api';
import { avisoDeLinea } from './avisoDeLinea';

const linea = (cambios: Partial<LineaCarrito> = {}): LineaCarrito => ({
  idLinea: 1,
  idVariante: 10,
  idProducto: 5,
  producto: 'Camisa Oxford',
  sku: 'OXF-M-AZ',
  descripcionAtributos: 'Azul / M',
  imagen: null,
  ilustracion: 'Camisa',
  color: 'Azul',
  cantidad: 2,
  precioUnitario: '249.00',
  totalLinea: '498.00',
  totalComprable: '498.00',
  descuentoLinea: '0.00',
  estado: 'Disponible',
  ajustarA: null,
  existencia: { estado: 'Disponible', unidadesRestantes: null },
  garantiaHasta: '2026-11-09T05:30:00.000Z',
  aviso: null,
  ...cambios,
});

describe('avisoDeLinea: un solo mapa, primero el estado y después el aviso (M3-H02)', () => {
  it('NoDisponible: error, solo se elimina y la cantidad se deshabilita', () => {
    expect(
      avisoDeLinea(
        linea({
          estado: 'NoDisponible',
          aviso: { tipo: 'BajoDePrecio', precioAnterior: '300.00' },
        }),
      ),
    ).toEqual({
      tipo: 'error',
      texto: 'Este producto ya no está disponible.',
      bloqueaCantidad: true,
    });
  });

  it('Agotado: error', () => {
    expect(avisoDeLinea(linea({ estado: 'Agotado' }))).toEqual({
      tipo: 'error',
      texto: 'Se agotó. Elimínalo para continuar.',
      bloqueaCantidad: false,
    });
  });

  it('CantidadExcedida: advertencia con «Ajustar a N»', () => {
    expect(avisoDeLinea(linea({ estado: 'CantidadExcedida', ajustarA: 3 }))).toEqual({
      tipo: 'advertencia',
      texto: 'Solo hay 3 disponibles. Ajusta la cantidad para continuar.',
      accion: { tipo: 'ajustar', cantidad: 3 },
      bloqueaCantidad: false,
    });
  });

  it('CantidadExcedida con uno solo: «Solo queda 1 disponible.» (frame 38:807)', () => {
    expect(avisoDeLinea(linea({ estado: 'CantidadExcedida', ajustarA: 1 }))?.texto).toBe(
      'Solo queda 1 disponible. Ajusta la cantidad para continuar.',
    );
  });

  it('CambioDePrecio: advertencia con los dos precios del backend y «Entendido»', () => {
    expect(
      avisoDeLinea(
        linea({
          precioUnitario: '459.00',
          aviso: { tipo: 'CambioDePrecio', precioAnterior: '429.00' },
        }),
      ),
    ).toEqual({
      tipo: 'advertencia',
      texto: 'La garantía venció y el precio cambió de Q429.00 a Q459.00.',
      accion: { tipo: 'entendido' },
      bloqueaCantidad: false,
    });
  });

  it('BajoDePrecio: éxito con el precio anterior', () => {
    expect(
      avisoDeLinea(linea({ aviso: { tipo: 'BajoDePrecio', precioAnterior: '429.00' } })),
    ).toEqual({
      tipo: 'exito',
      texto: '¡Bajó de precio! Antes costaba Q429.00.',
      bloqueaCantidad: false,
    });
  });

  it('PrecioGarantizado: info con la fecha de Guatemala', () => {
    expect(
      avisoDeLinea(linea({ aviso: { tipo: 'PrecioGarantizado', precioAnterior: null } })),
    ).toEqual({
      tipo: 'info',
      texto: 'Precio garantizado hasta el 8 de noviembre.',
      bloqueaCantidad: false,
    });
  });

  it('Disponible y sin aviso: nada', () => {
    expect(avisoDeLinea(linea())).toBeNull();
  });
});
