import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { comoCliente } from '../carrito/apoyo-carrito.js';
import { crearCupon } from '../checkout/apoyo-checkout.js';

usarBaseDePruebas();

// Grupo secuencial: compara páginas y totales de toda la bitácora, que las pruebas en paralelo cambiarían
// entre una consulta y otra (una fila nueva desplaza las páginas).

const app = crearApp(dependenciasDePrueba());
let admin: { token: string };

beforeAll(async () => {
  admin = {
    token: leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken,
  };
});

const paginaSchema = z.object({
  datos: z.array(z.object({ idBitacora: z.string(), modulo: z.string(), fecha: z.string() })),
  paginacion: z.object({ pagina: z.number(), tamano: z.number(), total: z.number() }),
});

const bitacora = async (consulta: string) =>
  paginaSchema.parse(
    (await request(app).get(`/api/v1/bitacora?${consulta}`).set(comoCliente(admin.token))).body,
  );

describe('bitácora paginada en el servidor (E7-H02, RF-09)', () => {
  it('filtra solo por módulo: todas las filas son del módulo y el total es menor que sin filtro', async () => {
    await crearCupon(app, admin.token, { limiteUsosTotal: 2 });

    const cupones = await bitacora('modulo=Cupones&tamano=100');
    const todo = await bitacora('tamano=1');

    expect(cupones.datos.length).toBeGreaterThan(0);
    expect(cupones.datos.every((r) => r.modulo === 'Cupones')).toBe(true);
    expect(cupones.paginacion.total).toBeLessThan(todo.paginacion.total);
  });

  it('pagina en el servidor: páginas distintas y el total del filtro, lo más reciente primero', async () => {
    await crearCupon(app, admin.token, { limiteUsosTotal: 2 });
    await crearCupon(app, admin.token, { limiteUsosTotal: 2 });

    const primera = await bitacora('modulo=Cupones&tamano=1&pagina=1');
    const segunda = await bitacora('modulo=Cupones&tamano=1&pagina=2');

    expect(primera.datos).toHaveLength(1);
    expect(primera.paginacion).toMatchObject({ pagina: 1, tamano: 1 });
    expect(primera.paginacion.total).toBeGreaterThanOrEqual(2);
    expect(primera.datos[0]?.idBitacora).not.toBe(segunda.datos[0]?.idBitacora);
    expect(Date.parse(primera.datos[0]?.fecha ?? '')).toBeGreaterThanOrEqual(
      Date.parse(segunda.datos[0]?.fecha ?? ''),
    );
  });
});
