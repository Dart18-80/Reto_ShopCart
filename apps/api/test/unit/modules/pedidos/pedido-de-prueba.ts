import { Decimal } from 'decimal.js';
import type { Pedido } from '../../../../src/modules/pedidos/pedidos.types.js';

/** Un pedido completo para los falsos del repositorio; cada prueba cambia lo que le importa. */
export const pedidoDePrueba = (cambios: Partial<Pedido> = {}): Pedido => ({
  idPedido: 3,
  numeroPedido: 'SC-000010',
  estado: 'Pagado',
  estadoPago: 'Confirmado',
  puedeCancelar: true,
  subtotal: new Decimal(0),
  descuento: new Decimal(0),
  costoEnvio: new Decimal(0),
  total: new Decimal(0),
  baseImponible: new Decimal(0),
  iva: new Decimal(0),
  montoReembolsado: new Decimal(0),
  codigoCupon: null,
  envio: { nombre: 'Estándar', fechaEstimadaEntrega: '2026-11-05' },
  fechaPago: new Date('2026-11-01T12:00:00Z'),
  fechaPagoLocal: '2026-11-01',
  tarjeta: { marca: 'Visa', ultimosDigitos: '4242' },
  direccion: {
    nombreRecibe: 'Ana',
    telefonoRecibe: '55551234',
    departamento: 'Guatemala',
    municipio: 'Guatemala',
    direccionLinea: 'Zona 1',
    referencia: null,
  },
  lineas: [],
  historial: [],
  ...cambios,
});
