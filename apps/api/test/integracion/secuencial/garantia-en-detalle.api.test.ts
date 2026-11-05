import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { varianteVendible } from '../carrito/apoyo-carrito.js';
import { conToken, tokenDeAdmin } from '../catalogo/apoyo-catalogo.js';

usarBaseDePruebas();

// Grupo secuencial: cambia un parámetro global y lo deja como estaba.

const app = crearApp(dependenciasDePrueba());
const plazoSchema = z.object({ diasGarantiaPrecio: z.number() });

let token: string;

beforeAll(async () => {
  token = await tokenDeAdmin(app);
});

const fijarPlazo = (dias: number) =>
  request(app)
    .patch('/api/v1/admin/configuracion')
    .set(conToken(token))
    .send({ diasGarantiaPrecio: dias });

describe('el plazo de la garantía en el detalle sale de la configuración (M2-H01, N-02)', () => {
  it('cambiar diasGarantiaPrecio en /admin/configuracion cambia el número en GET /productos/{id}', async () => {
    const { IDProducto } = await varianteVendible();
    const anterior = leerDatos(
      await request(app).get('/api/v1/admin/configuracion').set(conToken(token)),
      plazoSchema,
    ).diasGarantiaPrecio;
    const nuevo = anterior === 7 ? 9 : 7;
    try {
      expect((await fijarPlazo(nuevo)).status).toBe(200);

      const detalle = await request(app).get(`/api/v1/productos/${String(IDProducto)}`);

      expect(leerDatos(detalle, plazoSchema).diasGarantiaPrecio).toBe(nuevo);
    } finally {
      await fijarPlazo(anterior);
    }
  });
});
