import { describe, expect, it } from 'vitest';
import {
  calcularCobertura,
  diferenciasDeFoto,
  operacionesDelDocumento,
  rutasUsadas,
  serializarFoto,
  type DocumentoOpenApi,
} from './contrato.ts';

const documento: DocumentoOpenApi = {
  paths: {
    '/api/v1/health': { get: { tags: ['Sistema'] } },
    '/api/v1/pedidos': { get: { tags: ['Pedidos'] } },
    '/api/v1/pedidos/{id}': { get: { tags: ['Pedidos'] } },
    '/api/v1/pedidos/{id}/cancelar': { post: { tags: ['Pedidos'] } },
    '/api/v1/carrito': { get: { tags: ['Carrito'] }, delete: { tags: ['Carrito'] } },
  },
};

describe('serializarFoto (formato estable)', () => {
  it('el mismo contenido con las claves en otro orden produce el mismo texto', () => {
    const a = { b: { y: 1, x: [3, { q: 1, p: 2 }] }, a: 'z' };
    const b = { a: 'z', b: { x: [3, { p: 2, q: 1 }], y: 1 } };

    expect(serializarFoto(a)).toBe(serializarFoto(b));
  });

  it('conserva el orden de los arreglos y termina en salto de línea', () => {
    const texto = serializarFoto({ enum: ['fecha', 'total'] });

    expect(texto.indexOf('fecha')).toBeLessThan(texto.indexOf('total'));
    expect(texto.endsWith('}\n')).toBe(true);
  });
});

describe('diferenciasDeFoto (openapi:verificar)', () => {
  it('sin cambios no hay diferencias', () => {
    const archivos = { 'openapi.json': '{}\n', 'src/openapi.ts': 'export {};\n' };

    expect(diferenciasDeFoto(archivos, { ...archivos })).toEqual([]);
  });

  it('una descripción cambiada en la API sin reexportar es una diferencia de la foto', () => {
    const guardada = serializarFoto({
      components: { schemas: { Pedido: { description: 'Antes' } } },
    });
    const generada = serializarFoto({
      components: { schemas: { Pedido: { description: 'Después' } } },
    });

    expect(
      diferenciasDeFoto(
        { 'openapi.json': generada, 'src/openapi.ts': 'x' },
        { 'openapi.json': guardada, 'src/openapi.ts': 'x' },
      ),
    ).toEqual(['openapi.json']);
  });

  it('un archivo que falta es una diferencia', () => {
    expect(diferenciasDeFoto({ 'openapi.json': '{}' }, { 'openapi.json': undefined })).toEqual([
      'openapi.json',
    ]);
  });
});

describe('operacionesDelDocumento', () => {
  it('lista cada método y ruta con su módulo (la etiqueta de OpenAPI)', () => {
    expect(operacionesDelDocumento(documento)).toContainEqual({
      metodo: 'DELETE',
      ruta: '/api/v1/carrito',
      modulo: 'Carrito',
    });
    expect(operacionesDelDocumento(documento)).toHaveLength(6);
  });
});

describe('rutasUsadas (rutas literales de los *.api.ts)', () => {
  it('encuentra cada llamada al cliente api con su método', () => {
    const fuente = `
      const { data } = await api.GET('/api/v1/pedidos/{id}', { params: { path: { id } } });
      await api.POST(
        '/api/v1/pedidos/{id}/cancelar',
        { body },
      );
    `;

    expect(rutasUsadas(fuente)).toEqual([
      { metodo: 'GET', ruta: '/api/v1/pedidos/{id}' },
      { metodo: 'POST', ruta: '/api/v1/pedidos/{id}/cancelar' },
    ]);
  });
});

describe('calcularCobertura (contrato:cobertura)', () => {
  const exclusiones = [{ metodo: 'GET', ruta: '/api/v1/health', motivo: 'Healthcheck' }];

  it('agrupa por módulo y marca cada ruta como cubierta, excluida o pendiente', () => {
    const resultado = calcularCobertura(
      operacionesDelDocumento(documento),
      [{ metodo: 'GET', ruta: '/api/v1/pedidos/{id}' }],
      exclusiones,
    );

    expect(resultado.modulos.get('Pedidos')).toEqual([
      { metodo: 'GET', ruta: '/api/v1/pedidos', estado: 'pendiente' },
      { metodo: 'GET', ruta: '/api/v1/pedidos/{id}', estado: 'cubierta' },
      { metodo: 'POST', ruta: '/api/v1/pedidos/{id}/cancelar', estado: 'pendiente' },
    ]);
    expect(resultado.modulos.get('Sistema')).toEqual([
      { metodo: 'GET', ruta: '/api/v1/health', estado: 'excluida', motivo: 'Healthcheck' },
    ]);
    expect(resultado.pendientes).toBe(4);
  });

  it('señala una exclusión o una ruta usada que no existen en la foto', () => {
    const resultado = calcularCobertura(
      operacionesDelDocumento(documento),
      [{ metodo: 'GET', ruta: '/api/v1/no-existe' }],
      [...exclusiones, { metodo: 'GET', ruta: '/api/docs', motivo: 'Swagger' }],
    );

    expect(resultado.inconsistencias).toEqual([
      'Exclusión sin ruta en la foto: GET /api/docs',
      'Ruta usada en la web que no está en la foto: GET /api/v1/no-existe',
    ]);
  });
});
