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

type EstadoReembolso = Respuesta<
  '/api/v1/pedidos/{id}/cancelar',
  'post'
>['datos']['reembolso']['estado'];

interface ErrorSimulado {
  status: number;
  codigo: string;
  mensaje: string;
}

/**
 * `POST /pedidos/{id}/cancelar`: responde el pedido cancelado con su reembolso, o el error indicado. Guarda cada
 * cuerpo recibido.
 */
export function simularCancelacion(
  respuesta: { pedido: PedidoDePrueba; estadoReembolso: EstadoReembolso } | ErrorSimulado,
) {
  const recibidos: unknown[] = [];
  servidor.use(
    http.post('/api/v1/pedidos/:id/cancelar', async ({ request }) => {
      recibidos.push(await request.json());
      if ('status' in respuesta) {
        const { status, ...error } = respuesta;
        return HttpResponse.json({ error: { ...error, requestId: 'req-can' } }, { status });
      }
      return HttpResponse.json({
        datos: {
          pedido: respuesta.pedido,
          reembolso: { idReembolso: 9, estado: respuesta.estadoReembolso },
        },
      });
    }),
  );
  return recibidos;
}

// --- Gestión (M8): Operador y Administrador.

type ListaGestion = Respuesta<'/api/v1/admin/pedidos', 'get'>;
type ResumenGestion = ListaGestion['datos'][number];
export type PedidoGestionDePrueba = Respuesta<'/api/v1/admin/pedidos/{id}', 'get'>['datos'];

const CLIENTE = { idUsuario: 7, nombre: 'María López', correo: 'maria@correo.gt' };

export const resumenGestionDePrueba = (cambios: Partial<ResumenGestion> = {}): ResumenGestion => ({
  ...resumenDePrueba(),
  cliente: CLIENTE,
  ...cambios,
});

export const pedidoGestionDePrueba = (
  cambios: Partial<PedidoGestionDePrueba> = {},
): PedidoGestionDePrueba => {
  const base = pedidoDePrueba();
  return {
    ...base,
    lineas: base.lineas.map((linea) => ({
      ...linea,
      devolvible: linea.cantidad - linea.cantidadDevuelta,
    })),
    cliente: CLIENTE,
    transicionesPermitidas: ['EnPreparacion'],
    puedeDevolver: false,
    ...cambios,
  };
};

/** `GET /admin/pedidos` con la página indicada; guarda la consulta de cada petición. */
export function simularPedidosGestion(
  pedidos: ResumenGestion[],
  paginacion: Partial<ListaGestion['paginacion']> = {},
) {
  const consultas: URLSearchParams[] = [];
  servidor.use(
    http.get('/api/v1/admin/pedidos', ({ request }) => {
      consultas.push(new URL(request.url).searchParams);
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

/**
 * `GET /admin/pedidos/{id}`: el pedido, o `404` si no existe. `reemplazar` cambia lo que responden las lecturas
 * siguientes (otro empleado lo movió) y `lecturas` cuenta cuántas veces se pidió.
 */
export function simularPedidoGestion(inicial: PedidoGestionDePrueba | null) {
  let actual = inicial;
  const lecturas = { total: 0 };
  servidor.use(
    http.get('/api/v1/admin/pedidos/:id', () => {
      lecturas.total += 1;
      return actual
        ? HttpResponse.json({ datos: actual })
        : HttpResponse.json(NO_ENCONTRADO, { status: 404 });
    }),
  );
  return {
    lecturas,
    reemplazar: (pedido: PedidoGestionDePrueba) => {
      actual = pedido;
    },
  };
}

const responderError = ({ status, ...error }: ErrorSimulado) =>
  HttpResponse.json({ error: { ...error, requestId: 'req-ges' } }, { status });

/** `POST /admin/pedidos/{id}/estado`: el pedido con su nuevo estado, o el error indicado. Guarda cada cuerpo. */
export function simularCambioEstado(respuesta: PedidoDePrueba | ErrorSimulado) {
  const recibidos: unknown[] = [];
  servidor.use(
    http.post('/api/v1/admin/pedidos/:id/estado', async ({ request }) => {
      recibidos.push(await request.json());
      return 'status' in respuesta
        ? responderError(respuesta)
        : HttpResponse.json({ datos: respuesta });
    }),
  );
  return recibidos;
}

/** `POST /admin/pedidos/{id}/cancelar`: el pedido cancelado con su reembolso, o el error indicado. */
export function simularCancelacionGestion(
  respuesta: { pedido: PedidoDePrueba; estadoReembolso: EstadoReembolso } | ErrorSimulado,
) {
  const recibidos: unknown[] = [];
  servidor.use(
    http.post('/api/v1/admin/pedidos/:id/cancelar', async ({ request }) => {
      recibidos.push(await request.json());
      if ('status' in respuesta) return responderError(respuesta);
      return HttpResponse.json({
        datos: {
          pedido: respuesta.pedido,
          reembolso: { idReembolso: 9, estado: respuesta.estadoReembolso },
        },
      });
    }),
  );
  return recibidos;
}
