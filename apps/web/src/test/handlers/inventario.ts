import { http, HttpResponse } from 'msw';
import type { Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

export type Existencia = Respuesta<'/api/v1/inventario/existencias', 'get'>['datos'][number];
export type Descuadre = Respuesta<'/api/v1/inventario/conciliacion', 'get'>['datos'][number];

export const existenciaDePrueba = (cambios: Partial<Existencia> = {}): Existencia => ({
  idVariante: 50,
  sku: 'CAM-OXF-AZ-M',
  idProducto: 5,
  producto: 'Camisa Oxford',
  descripcionAtributos: 'Azul / M',
  activo: true,
  existenciaFisica: 24,
  reservado: 2,
  disponible: 22,
  ...cambios,
});

export const descuadreDePrueba = (cambios: Partial<Descuadre> = {}): Descuadre => ({
  idVariante: 50,
  sku: 'CAM-OXF-AZ-M',
  existenciaFisica: 24,
  sumaKardex: 23,
  existenciaUltimoMovimiento: 23,
  ...cambios,
});

/** Devuelve las consultas que recibió, para verificar lo que la página pidió al servidor. */
export function simularExistencias(existencias: Existencia[]) {
  const consultas: URLSearchParams[] = [];
  servidor.use(
    http.get('/api/v1/inventario/existencias', ({ request }) => {
      consultas.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        datos: existencias,
        paginacion: { pagina: 1, tamano: 20, total: existencias.length, totalPaginas: 1 },
      });
    }),
  );
  return consultas;
}

export function simularConciliacion(descuadres: Descuadre[] = []) {
  servidor.use(
    http.get('/api/v1/inventario/conciliacion', () => HttpResponse.json({ datos: descuadres })),
  );
}

export type Movimiento = Respuesta<'/api/v1/inventario/kardex', 'get'>['datos'][number];

export const movimientoDePrueba = (cambios: Partial<Movimiento> = {}): Movimiento => ({
  idMovimientoKardex: 900,
  idVariante: 50,
  tipo: 'EntradaCompra',
  signo: 1,
  cantidad: 20,
  existenciaAnterior: 6,
  existenciaResultante: 26,
  motivo: 'Compra al proveedor',
  referencia: 'F-221',
  idPedido: null,
  idDevolucion: null,
  usuario: { idUsuario: 3, nombre: 'Operador Demo' },
  fecha: '2026-11-01T15:00:00.000Z',
  ...cambios,
});

/** Devuelve las consultas del kardex que recibió. */
export function simularKardex(movimientos: Movimiento[]) {
  const consultas: URLSearchParams[] = [];
  servidor.use(
    http.get('/api/v1/inventario/kardex', ({ request }) => {
      consultas.push(new URL(request.url).searchParams);
      return HttpResponse.json({
        datos: movimientos,
        paginacion: { pagina: 1, tamano: 20, total: movimientos.length, totalPaginas: 1 },
      });
    }),
  );
  return consultas;
}

interface ErrorSimulado {
  status: number;
  codigo: string;
  mensaje: string;
  detalles?: unknown;
}

/** Un POST de movimiento (entrada o ajuste): responde el movimiento o el error dado; devuelve los cuerpos. */
function simularMovimiento(ruta: string, resultado: Movimiento | ErrorSimulado) {
  const cuerpos: unknown[] = [];
  servidor.use(
    http.post(ruta, async ({ request }) => {
      cuerpos.push(await request.json());
      if ('status' in resultado) {
        const { status, ...error } = resultado;
        return HttpResponse.json({ error: { ...error, requestId: 'req-inv-1' } }, { status });
      }
      return HttpResponse.json({ datos: resultado }, { status: 201 });
    }),
  );
  return cuerpos;
}

export const simularAjuste = (resultado: Movimiento | ErrorSimulado) =>
  simularMovimiento('/api/v1/inventario/ajustes', resultado);

export const simularEntrada = (resultado: Movimiento | ErrorSimulado) =>
  simularMovimiento('/api/v1/inventario/entradas', resultado);
