import { http, HttpResponse } from 'msw';
import type { Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

type MetodosEnvio = Respuesta<'/api/v1/envios/metodos', 'get'>['datos'];
type MetodoEnvio = MetodosEnvio['metodos'][number];
export type SesionPago = Respuesta<'/api/v1/checkout/sesion', 'get'>['datos'];

export const METODO_ESTANDAR: MetodoEnvio = {
  idMetodoEnvio: 1,
  codigo: 'Estandar',
  nombre: 'Estándar',
  diasMin: 3,
  diasMax: 5,
  tarifa: '35.00',
  costo: '35.00',
  envioGratis: false,
  totalConEnvio: '533.00',
};

const EXPRESS: MetodoEnvio = {
  idMetodoEnvio: 2,
  codigo: 'Express',
  nombre: 'Express',
  diasMin: 1,
  diasMax: 1,
  tarifa: '75.00',
  costo: '75.00',
  envioGratis: false,
  totalConEnvio: '573.00',
};

export const metodosDePrueba = (cambios: Partial<MetodosEnvio> = {}): MetodosEnvio => ({
  metodos: [METODO_ESTANDAR, EXPRESS],
  minutosReserva: 15,
  envioGratis: { montoMinimo: '500.00', faltante: '2.00', alcanzado: false },
  ...cambios,
});

/** `GET /envios/metodos` con los métodos indicados (el backend ya calculó costo y total con envío). */
export function simularMetodosEnvio(metodos: MetodosEnvio = metodosDePrueba()) {
  servidor.use(http.get('/api/v1/envios/metodos', () => HttpResponse.json({ datos: metodos })));
}

export const sesionDePrueba = (cambios: Partial<SesionPago> = {}): SesionPago => ({
  idSesion: 7,
  expiraEn: '2026-11-05T18:15:00.000Z',
  direccion: {
    nombreRecibe: 'Ana Pérez',
    telefonoRecibe: '55551234',
    idMunicipio: 101,
    municipio: 'Guatemala',
    departamento: 'Guatemala',
    direccionLinea: '5a avenida 10-20, zona 1',
    referencia: null,
  },
  envio: { idMetodoEnvio: 1, nombre: 'Estándar', diasMin: 3, diasMax: 5, costo: '35.00' },
  codigoCupon: null,
  lineas: [
    {
      idVariante: 10,
      idProducto: 5,
      producto: 'Camisa Oxford',
      sku: 'OXF-M-AZ',
      descripcionAtributos: 'Azul / M',
      cantidad: 2,
      precioUnitario: '249.00',
      descuentoLinea: '0.00',
      totalLinea: '498.00',
    },
  ],
  subtotal: '498.00',
  descuento: '0.00',
  total: '533.00',
  intentosRechazados: 0,
  ...cambios,
});

const RUTA_SESION = '/api/v1/checkout/sesion';

const NO_ENCONTRADA = {
  error: { codigo: 'NO_ENCONTRADO', mensaje: 'No tienes un pago en curso.', requestId: 'req-ses' },
};

/** `GET /checkout/sesion`: la sesión Activa del Cliente, o `404` si no tiene. */
export function simularSesionPago(sesion: SesionPago | null) {
  servidor.use(
    http.get(RUTA_SESION, () =>
      sesion
        ? HttpResponse.json({ datos: sesion })
        : HttpResponse.json(NO_ENCONTRADA, { status: 404 }),
    ),
  );
}

interface ErrorSimulado {
  status: number;
  codigo: string;
  mensaje: string;
  detalles?: unknown;
}

/** `POST /checkout/sesion`: crea la sesión (o responde el error indicado) y guarda cada cuerpo recibido. */
export function simularInicioDePago(respuesta: SesionPago | ErrorSimulado = sesionDePrueba()) {
  const recibidos: unknown[] = [];
  servidor.use(
    http.post(RUTA_SESION, async ({ request }) => {
      recibidos.push(await request.json());
      if ('status' in respuesta) {
        const { status, ...error } = respuesta;
        return HttpResponse.json({ error: { ...error, requestId: 'req-ini' } }, { status });
      }
      simularSesionPago(respuesta);
      return HttpResponse.json({ datos: respuesta }, { status: 201 });
    }),
  );
  return recibidos;
}
