import {
  actualizarCategoriaSchema,
  crearAtributoSchema,
  crearCategoriaSchema,
  crearValorAtributoSchema,
} from '@shopcart/shared';
import { http, HttpResponse } from 'msw';
import type { Respuesta } from '../../shared/api';
import { servidor } from '../servidor';

export type CategoriaAdmin = Respuesta<'/api/v1/admin/categorias', 'get'>['datos'][number];
export type Atributo = Respuesta<'/api/v1/admin/atributos', 'get'>['datos'][number];

export const categoriaAdminDePrueba = (cambios: Partial<CategoriaAdmin> = {}): CategoriaAdmin => ({
  idCategoria: 1,
  nombre: 'Camisas y blusas',
  descripcion: null,
  ilustracion: 'Camisa',
  activo: true,
  productos: 12,
  ...cambios,
});

export const atributoDePrueba = (cambios: Partial<Atributo> = {}): Atributo => ({
  idAtributo: 1,
  nombre: 'Talla',
  orden: 1,
  valores: [
    { idValorAtributo: 11, valor: 'S', orden: 1 },
    { idValorAtributo: 12, valor: 'M', orden: 2 },
  ],
  ...cambios,
});

interface ErrorSimulado {
  status: number;
  codigo: string;
  mensaje: string;
}

const responderError = ({ status, ...error }: ErrorSimulado) =>
  HttpResponse.json({ error: { ...error, requestId: 'req-cat' } }, { status });

export interface Recibido {
  metodo: string;
  ruta: string;
  cuerpo?: unknown;
}

/**
 * Las categorías y los atributos del Admin, como los haría el backend: listar, crear, editar, activar, desactivar
 * y eliminar; crear atributos y valores. `errores` fuerza la respuesta de una operación («POST desactivar»).
 * Guarda cada operación recibida.
 */
export function simularCatalogoAdmin(
  categoriasIniciales: CategoriaAdmin[],
  atributosIniciales: Atributo[] = [],
  errores: Partial<Record<string, ErrorSimulado>> = {},
) {
  let categorias = [...categoriasIniciales];
  let atributos = [...atributosIniciales];
  let siguiente = 100;
  const recibidos: Recibido[] = [];
  const anotar = (metodo: string, ruta: string, cuerpo?: unknown) => {
    recibidos.push(cuerpo === undefined ? { metodo, ruta } : { metodo, ruta, cuerpo });
    return errores[`${metodo} ${ruta}`];
  };
  const cambiar = (id: number, cambios: Partial<CategoriaAdmin>) => {
    categorias = categorias.map((c) => (c.idCategoria === id ? { ...c, ...cambios } : c));
    return categorias.find((c) => c.idCategoria === id);
  };
  servidor.use(
    http.get('/api/v1/admin/categorias', () => HttpResponse.json({ datos: categorias })),
    http.post('/api/v1/admin/categorias', async ({ request }) => {
      const cuerpo = crearCategoriaSchema.parse(await request.json());
      const error = anotar('POST', 'crear', cuerpo);
      if (error) return responderError(error);
      siguiente += 1;
      const nueva = categoriaAdminDePrueba({
        idCategoria: siguiente,
        nombre: cuerpo.nombre,
        descripcion: cuerpo.descripcion ?? null,
        ilustracion: cuerpo.ilustracion ?? 'Camisa',
        productos: 0,
      });
      categorias = [...categorias, nueva];
      return HttpResponse.json({ datos: nueva }, { status: 201 });
    }),
    http.patch('/api/v1/admin/categorias/:id', async ({ params, request }) => {
      const cuerpo = actualizarCategoriaSchema.parse(await request.json());
      const error = anotar('PATCH', 'editar', cuerpo);
      if (error) return responderError(error);
      return HttpResponse.json({
        datos: cambiar(Number(params.id), {
          ...(cuerpo.nombre === undefined ? {} : { nombre: cuerpo.nombre }),
          ...(cuerpo.ilustracion === undefined ? {} : { ilustracion: cuerpo.ilustracion }),
          ...(cuerpo.descripcion === undefined ? {} : { descripcion: cuerpo.descripcion }),
        }),
      });
    }),
    http.post('/api/v1/admin/categorias/:id/:accion', ({ params }) => {
      const accion = String(params.accion);
      const error = anotar('POST', accion);
      if (error) return responderError(error);
      return HttpResponse.json({
        datos: cambiar(Number(params.id), { activo: accion === 'activar' }),
      });
    }),
    http.delete('/api/v1/admin/categorias/:id', ({ params }) => {
      const error = anotar('DELETE', 'eliminar');
      if (error) return responderError(error);
      categorias = categorias.filter((c) => c.idCategoria !== Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
    http.get('/api/v1/admin/atributos', () => HttpResponse.json({ datos: atributos })),
    http.post('/api/v1/admin/atributos', async ({ request }) => {
      const cuerpo = crearAtributoSchema.parse(await request.json());
      const error = anotar('POST', 'atributo', cuerpo);
      if (error) return responderError(error);
      siguiente += 1;
      const nuevo = { idAtributo: siguiente, nombre: cuerpo.nombre, orden: 9, valores: [] };
      atributos = [...atributos, nuevo];
      return HttpResponse.json({ datos: nuevo }, { status: 201 });
    }),
    http.post('/api/v1/admin/atributos/:id/valores', async ({ params, request }) => {
      const cuerpo = crearValorAtributoSchema.parse(await request.json());
      const error = anotar('POST', 'valor', cuerpo);
      if (error) return responderError(error);
      siguiente += 1;
      const valor = { idValorAtributo: siguiente, valor: cuerpo.valor, orden: 99 };
      atributos = atributos.map((a) =>
        a.idAtributo === Number(params.id) ? { ...a, valores: [...a.valores, valor] } : a,
      );
      return HttpResponse.json(
        { datos: { ...valor, idAtributo: Number(params.id) } },
        { status: 201 },
      );
    }),
  );
  return recibidos;
}
