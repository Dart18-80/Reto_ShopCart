import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { conToken, tokenDeAdmin } from '../catalogo/apoyo-catalogo.js';

usarBaseDePruebas();

// Grupo secuencial: cambia un parámetro global y lo deja como estaba.

const app = crearApp(dependenciasDePrueba());
const minutosSchema = z.object({ minutosReserva: z.number() });

let token: string;

beforeAll(async () => {
  token = await tokenDeAdmin(app);
});

const fijarMinutos = (minutos: number) =>
  request(app)
    .patch('/api/v1/admin/configuracion')
    .set(conToken(token))
    .send({ minutosReserva: minutos });

describe('los minutos de la reserva en los métodos de envío salen de la configuración (M4-H02)', () => {
  it('cambiar minutosReserva en /admin/configuracion cambia el número en GET /envios/metodos', async () => {
    const anterior = leerDatos(
      await request(app).get('/api/v1/admin/configuracion').set(conToken(token)),
      minutosSchema,
    ).minutosReserva;
    const nuevo = anterior === 20 ? 25 : 20;
    try {
      expect((await fijarMinutos(nuevo)).status).toBe(200);

      const metodos = await request(app).get('/api/v1/envios/metodos');

      expect(leerDatos(metodos, minutosSchema).minutosReserva).toBe(nuevo);
    } finally {
      await fijarMinutos(anterior);
    }
  });
});
