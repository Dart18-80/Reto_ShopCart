import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { varianteVendible } from '../carrito/apoyo-carrito.js';

usarBaseDePruebas();

// Grupo secuencial: compara totales de toda la base, que las pruebas en paralelo cambiarían entre una
// consulta y otra.

const app = crearApp(dependenciasDePrueba());
const PAGINA_LEJANA = '100000';

const listadoSchema = z.object({
  datos: z.array(z.looseObject({})),
  paginacion: z.object({
    pagina: z.number(),
    tamano: z.number(),
    total: z.number(),
    totalPaginas: z.number(),
  }),
});

let admin: Record<string, string>;
let operador: Record<string, string>;

beforeAll(async () => {
  const token = async (correo: string, contrasena: string) =>
    leerSesion(await iniciarSesion(app, correo, contrasena)).accessToken;
  admin = { Authorization: `Bearer ${await token('admin@shopcart.gt', 'Admin2026!')}` };
  operador = { Authorization: `Bearer ${await token('operador@shopcart.gt', 'Operador2026!')}` };
});

async function listado(ruta: string, consulta: Record<string, string>, cabeceras = admin) {
  const respuesta = await request(app).get(ruta).query(consulta).set(cabeceras);
  return listadoSchema.parse(respuesta.body);
}

describe('paginación: el total es real aunque la página pedida esté vacía', () => {
  it.each([
    ['/api/v1/usuarios', {}, 'admin'],
    ['/api/v1/productos', {}, 'publico'],
    ['/api/v1/admin/productos', {}, 'admin'],
    ['/api/v1/inventario/existencias', {}, 'operador'],
    ['/api/v1/inventario/bodega', {}, 'operador'],
  ] as const)('%s', async (ruta, consulta, quien) => {
    const cabeceras = quien === 'admin' ? admin : quien === 'operador' ? operador : {};

    const primera = await listado(ruta, { ...consulta, tamano: '2' }, cabeceras);
    const lejana = await listado(
      ruta,
      { ...consulta, tamano: '2', pagina: PAGINA_LEJANA },
      cabeceras,
    );

    expect(primera.paginacion.total).toBeGreaterThan(0);
    expect(lejana.datos).toEqual([]);
    expect(lejana.paginacion).toMatchObject({
      total: primera.paginacion.total,
      totalPaginas: primera.paginacion.totalPaginas,
    });
  });

  it('/api/v1/inventario/kardex', async () => {
    // Una variante propia con existencia: tiene al menos un movimiento en el kardex.
    const { IDVariante } = await varianteVendible('10.00', 3);
    const consulta = { variante: String(IDVariante), tamano: '1' };

    const primera = await listado('/api/v1/inventario/kardex', consulta, operador);
    const lejana = await listado(
      '/api/v1/inventario/kardex',
      { ...consulta, pagina: PAGINA_LEJANA },
      operador,
    );

    expect(primera.paginacion.total).toBeGreaterThan(0);
    expect(lejana.datos).toEqual([]);
    expect(lejana.paginacion.total).toBe(primera.paginacion.total);
  });
});
