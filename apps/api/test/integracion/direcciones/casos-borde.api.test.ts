import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { leerSesion, registrar } from '../auth/apoyo-auth.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const MIXCO = { departamento: 'Guatemala', municipio: 'Mixco' };
const INT_MAXIMO = 2_147_483_647;

const direccionSchema = z.looseObject({
  idDireccion: z.number(),
  alias: z.string().nullable(),
  nombreRecibe: z.string(),
  referencia: z.string().nullable(),
});

let idMixco: number | undefined;
async function idMunicipio(): Promise<number> {
  if (idMixco !== undefined) return idMixco;
  const departamentos = leerDatos(
    await request(app).get('/api/v1/departamentos'),
    z.array(z.object({ idDepartamento: z.number(), nombre: z.string() })),
  );
  const id = departamentos.find((d) => d.nombre === MIXCO.departamento)?.idDepartamento;
  const municipios = leerDatos(
    await request(app).get(`/api/v1/departamentos/${String(id)}/municipios`),
    z.array(z.object({ idMunicipio: z.number(), nombre: z.string() })),
  );
  idMixco = municipios.find((m) => m.nombre === MIXCO.municipio)?.idMunicipio;
  if (idMixco === undefined) throw new Error('Municipio de prueba no encontrado');
  return idMixco;
}

async function tokenDeCliente(): Promise<string> {
  return leerSesion(await registrar(app)).accessToken;
}

async function crear(token: string, cambios: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/v1/direcciones')
    .set('Authorization', `Bearer ${token}`)
    .send({
      nombreRecibe: 'Ana Pérez',
      telefonoRecibe: '55554444',
      idMunicipio: await idMunicipio(),
      direccionLinea: '5a avenida 10-20, zona 1',
      ...cambios,
    });
}

describe('casos borde de las entradas de direcciones (E2-H05)', () => {
  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['un número', 123],
    ['null', null],
  ])('nombreRecibe %s responde 400', async (_caso, valor) => {
    const respuesta = await crear(await tokenDeCliente(), { nombreRecibe: valor });

    expect(respuesta.status).toBe(400);
    expect(leerError(respuesta).codigo).toBe('VALIDACION_FALLIDA');
  });

  it('acepta un nombre de 100 unidades UTF-16 con emojis y lo guarda completo; 101 responde 400', async () => {
    const token = await tokenDeCliente();
    const justo = `${'😀'.repeat(49)}Ñu`;

    const guardada = leerDatos(await crear(token, { nombreRecibe: justo }), direccionSchema);
    const unoMas = await crear(token, { nombreRecibe: `${justo}a` });

    expect(guardada.nombreRecibe).toBe(justo);
    expect(unoMas.status).toBe(400);
  });

  it('recorta los espacios y normaliza a NFC antes de guardar', async () => {
    const descompuesto = '  José Pérez  ';

    const guardada = leerDatos(
      await crear(await tokenDeCliente(), { nombreRecibe: descompuesto }),
      direccionSchema,
    );

    expect(guardada.nombreRecibe).toBe('José Pérez');
  });

  it.each([
    ['con espacio', '5555 4444'],
    ['de 7 dígitos', '5555444'],
    ['de 9 dígitos', '555544441'],
    ['con dígitos no ASCII', '٥٥٥٥٤٤٤٤'],
    ['como número', 55554444],
  ])('un teléfono %s responde 400', async (_caso, telefonoRecibe) => {
    expect((await crear(await tokenDeCliente(), { telefonoRecibe })).status).toBe(400);
  });

  it.each([
    ['0', 0],
    ['negativo', -1],
    ['decimal', 1.5],
    ['texto', '1'],
    ['fuera del rango de INT', INT_MAXIMO + 1],
  ])('idMunicipio %s responde 400', async (_caso, valor) => {
    const respuesta = await crear(await tokenDeCliente(), { idMunicipio: valor });

    expect(respuesta.status).toBe(400);
  });

  it('un cuerpo con la clave __proto__ responde 400 y no contamina Object.prototype', async () => {
    const token = await tokenDeCliente();
    const cuerpo = `{"nombreRecibe":"Ana","telefonoRecibe":"55554444","idMunicipio":${String(
      await idMunicipio(),
    )},"direccionLinea":"Zona 1","__proto__":{"contaminado":true}}`;

    const respuesta = await request(app)
      .post('/api/v1/direcciones')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send(cuerpo);

    expect(respuesta.status).toBe(400);
    expect(({} as Record<string, unknown>).contaminado).toBeUndefined();
  });

  it('un arreglo en lugar de objeto responde 400', async () => {
    const respuesta = await request(app)
      .post('/api/v1/direcciones')
      .set('Authorization', `Bearer ${await tokenDeCliente()}`)
      .send([{ nombreRecibe: 'Ana' }]);

    expect(respuesta.status).toBe(400);
  });

  it('un PATCH vacío responde 400', async () => {
    const token = await tokenDeCliente();
    const { idDireccion } = leerDatos(await crear(token), direccionSchema);

    const respuesta = await request(app)
      .patch(`/api/v1/direcciones/${String(idDireccion)}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(respuesta.status).toBe(400);
  });

  it('un PATCH con nombreRecibe null responde 400 (solo alias y referencia se quitan)', async () => {
    const token = await tokenDeCliente();
    const { idDireccion } = leerDatos(await crear(token), direccionSchema);

    const respuesta = await request(app)
      .patch(`/api/v1/direcciones/${String(idDireccion)}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombreRecibe: null });

    expect(respuesta.status).toBe(400);
  });
});

describe('casos borde de los IDs en la ruta (E2-H05)', () => {
  it.each(['abc', '0', '-1', '1.5', String(INT_MAXIMO + 1), '99999999999999999999'])(
    'GET /direcciones/%s responde 400',
    async (id) => {
      const respuesta = await request(app)
        .get(`/api/v1/direcciones/${id}`)
        .set('Authorization', `Bearer ${await tokenDeCliente()}`);

      expect(respuesta.status).toBe(400);
    },
  );

  it('el ID más grande de INT que no existe responde 404', async () => {
    const respuesta = await request(app)
      .get(`/api/v1/direcciones/${String(INT_MAXIMO)}`)
      .set('Authorization', `Bearer ${await tokenDeCliente()}`);

    expect(respuesta.status).toBe(404);
  });

  it('GET /departamentos/:id/municipios fuera del rango de INT responde 400', async () => {
    const respuesta = await request(app).get(
      `/api/v1/departamentos/${String(INT_MAXIMO + 1)}/municipios`,
    );

    expect(respuesta.status).toBe(400);
  });
});
