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
