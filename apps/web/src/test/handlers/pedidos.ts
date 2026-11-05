import { http, HttpResponse } from 'msw';
import type { Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

export type PedidoDePrueba = Respuesta<'/api/v1/pedidos/{id}', 'get'>['datos'];
type ListaDePedidos = Respuesta<'/api/v1/pedidos', 'get'>;
type ResumenDePedido = ListaDePedidos['datos'][number];

export const pedidoDePrueba = (cambios: Partial<PedidoDePrueba> = {}): PedidoDePrueba => ({
  idPedido: 41,
  numeroPedido: 'SC-000041',
  estado: 'Pagado',
  estadoPago: 'Confirmado',
  puedeCancelar: true,
  subtotal: '498.00',
  descuento: '0.00',
  costoEnvio: '35.00',
  total: '533.00',
  baseImponible: '475.89',
  iva: '57.11',
  montoReembolsado: '0.00',
  codigoCupon: null,
  envio: { nombre: 'Estándar', fechaEstimadaEntrega: '2026-11-10' },
  fechaPago: '2026-11-05T18:05:00.000Z',
  fechaPagoLocal: '2026-11-05',
  tarjeta: { marca: 'Visa', ultimosDigitos: '4242' },
  direccion: {
    nombreRecibe: 'Ana Pérez',
    telefonoRecibe: '55551234',
    departamento: 'Guatemala',
    municipio: 'Guatemala',
    direccionLinea: '5a avenida 10-20, zona 1',
    referencia: null,
  },
  lineas: [
    {
      idDetallePedido: 1,
      idVariante: 10,
      sku: 'OXF-M-AZ',
      producto: 'Camisa Oxford',
      descripcionVariante: 'Azul / M',
      categoria: 'Camisas',
      cantidad: 2,
      cantidadDevuelta: 0,
      precioUnitario: '249.00',
      descuentoLinea: '0.00',
      totalLinea: '498.00',
    },
  ],
  historial: [
    {
      estadoAnterior: null,
      estadoNuevo: 'Pagado',
      rol: 'Cliente',
      motivo: null,
      fecha: '2026-11-05T18:05:00.000Z',
    },
  ],
  ...cambios,
});

export const resumenDePrueba = (cambios: Partial<ResumenDePedido> = {}): ResumenDePedido => ({
  idPedido: 41,
  numeroPedido: 'SC-000041',
  estado: 'Pagado',
  estadoPago: 'Confirmado',
  total: '533.00',
  articulos: 2,
  fechaPago: '2026-11-05T18:05:00.000Z',
  fechaPagoLocal: '2026-11-05',
  ...cambios,
});

/** `GET /pedidos` con la página indicada; guarda la consulta de cada petición. */
export function simularMisPedidos(
  pedidos: ResumenDePedido[],
  paginacion: Partial<ListaDePedidos['paginacion']> = {},
) {
  const consultas: string[] = [];
  servidor.use(
    http.get('/api/v1/pedidos', ({ request }) => {
      consultas.push(new URL(request.url).search);
      return HttpResponse.json({
        datos: pedidos,
        paginacion: {
          pagina: 1,
          tamano: 20,
          total: pedidos.length,
          totalPaginas: 1,
          ...paginacion,
        },
      });
    }),
  );
  return consultas;
}

const NO_ENCONTRADO = {
  error: { codigo: 'NO_ENCONTRADO', mensaje: 'El pedido no existe.', requestId: 'req-ped' },
};

/** `GET /pedidos/{id}`: el pedido, o `404` (inexistente o de otro cliente, RF-01). */
export function simularPedido(pedido: PedidoDePrueba | null) {
  servidor.use(
    http.get('/api/v1/pedidos/:id', () =>
      pedido
        ? HttpResponse.json({ datos: pedido })
        : HttpResponse.json(NO_ENCONTRADO, { status: 404 }),
    ),
  );
}
