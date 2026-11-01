import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { direccionesRepository } from '../../../src/modules/direcciones/direcciones.repository.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { iniciarSesion, leerSesion, registrar } from '../auth/apoyo-auth.js';
import { comoActor } from '../datos-de-prueba.js';

// Los reintentos por deadlock de ejecutarSP ocultarían una carrera: las pruebas de concurrencia exigen cero.
const avisosDeDeadlock: string[] = [];
usarBaseDePruebas(
  pino(
    { level: 'warn' },
    {
      write: (linea: string) => {
        if (linea.includes('Deadlock')) avisosDeDeadlock.push(linea);
      },
    },
  ),
);

const app = crearApp(dependenciasDePrueba());

const direccionSchema = z.looseObject({
  idDireccion: z.number(),
  nombreRecibe: z.string(),
  alias: z.string().nullable(),
  esPredeterminada: z.boolean(),
  municipio: z.looseObject({
    nombre: z.string(),
    departamento: z.looseObject({ nombre: z.string() }),
  }),
});
const listaSchema = z.array(direccionSchema);
const geografiaSchema = z.array(z.looseObject({ nombre: z.string() }));
const departamentosSchema = z.array(z.object({ idDepartamento: z.number(), nombre: z.string() }));

async function tokenDeCliente(): Promise<string> {
  return leerSesion(await registrar(app)).accessToken;
}

async function idMunicipio(nombreDepartamento = 'Guatemala', nombreMunicipio = 'Mixco') {
  const departamentos = leerDatos(
    await request(app).get('/api/v1/departamentos'),
    departamentosSchema,
  );
  const departamento = departamentos.find((d) => d.nombre === nombreDepartamento);
  const municipios = leerDatos(
    await request(app).get(
      `/api/v1/departamentos/${String(departamento?.idDepartamento)}/municipios`,
    ),
    z.array(z.object({ idMunicipio: z.number(), nombre: z.string() })),
  );
  const municipio = municipios.find((m) => m.nombre === nombreMunicipio);
  if (municipio === undefined) throw new Error('Municipio de prueba no encontrado');
  return municipio.idMunicipio;
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

const con = (token: string) => ({ Authorization: `Bearer ${token}` });

describe('direcciones propias (E2-H05, RF-01, N-17)', () => {
  it('crea y lista las direcciones del cliente con su municipio y departamento', async () => {
    const token = await tokenDeCliente();

    const creada = await crear(token, { alias: 'Casa', esPredeterminada: true });
    const lista = leerDatos(
      await request(app).get('/api/v1/direcciones').set(con(token)),
      listaSchema,
    );

    expect(creada.status).toBe(201);
    expect(lista).toEqual([
      expect.objectContaining({
        alias: 'Casa',
        esPredeterminada: true,
        municipio: expect.objectContaining({
          nombre: 'Mixco',
          departamento: expect.objectContaining({ nombre: 'Guatemala' }) as unknown,
        }) as unknown,
      }),
    ]);
  });

  it('RF-01: un cliente que usa el ID de una dirección de otro recibe 404 al leerla, editarla o borrarla', async () => {
    const [deAna, deBeto] = [await tokenDeCliente(), await tokenDeCliente()];
    const { idDireccion } = leerDatos(await crear(deAna), direccionSchema);
    const ruta = `/api/v1/direcciones/${String(idDireccion)}`;

    const leer = await request(app).get(ruta).set(con(deBeto));
    const editar = await request(app)
      .patch(ruta)
      .set(con(deBeto))
      .send({ nombreRecibe: 'Intruso' });
    const borrar = await request(app).delete(ruta).set(con(deBeto));

    for (const respuesta of [leer, editar, borrar]) {
      expect(respuesta.status).toBe(404);
      expect(leerError(respuesta).codigo).toBe('NO_ENCONTRADO');
    }
    const deAnaIntacta = leerDatos(await request(app).get(ruta).set(con(deAna)), direccionSchema);
    expect(deAnaIntacta.nombreRecibe).toBe('Ana Pérez');
    expect(
      leerDatos(await request(app).get('/api/v1/direcciones').set(con(deBeto)), listaSchema),
    ).toEqual([]);
  });

  it('A-02: el SP rechaza editar o borrar una dirección ajena aunque el servicio no la haya filtrado', async () => {
    const deAna = await tokenDeCliente();
    const beto = leerSesion(await registrar(app)).usuario;
    const original = leerDatos(await crear(deAna), direccionSchema);
    const { idDireccion } = original;
    const municipio = await idMunicipio();
    const comoBeto = <T>(accion: () => Promise<T>) => comoActor(beto.idUsuario, 'Cliente', accion);

    const editar = comoBeto(() =>
      direccionesRepository.actualizar(idDireccion, {
        alias: null,
        nombreRecibe: 'Intruso',
        telefonoRecibe: '55554444',
        idMunicipio: municipio,
        direccionLinea: 'Otra',
        referencia: null,
        esPredeterminada: true,
      }),
    );
    await expect(editar).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO', status: 404 });
    await expect(comoBeto(() => direccionesRepository.eliminar(idDireccion))).rejects.toMatchObject(
      { codigo: 'NO_ENCONTRADO', status: 404 },
    );

    const ruta = `/api/v1/direcciones/${String(idDireccion)}`;
    expect(leerDatos(await request(app).get(ruta).set(con(deAna)), direccionSchema)).toEqual(
      original,
    );
  });

  it('marcar una dirección como predeterminada desmarca la anterior', async () => {
    const token = await tokenDeCliente();
    const primera = leerDatos(await crear(token, { esPredeterminada: true }), direccionSchema);
    const segunda = leerDatos(await crear(token), direccionSchema);

    await request(app)
      .patch(`/api/v1/direcciones/${String(segunda.idDireccion)}`)
      .set(con(token))
      .send({ esPredeterminada: true });

    const lista = leerDatos(
      await request(app).get('/api/v1/direcciones').set(con(token)),
      listaSchema,
    );
    expect(lista.filter((d) => d.esPredeterminada).map((d) => d.idDireccion)).toEqual([
      segunda.idDireccion,
    ]);
    expect(lista.find((d) => d.idDireccion === primera.idDireccion)?.esPredeterminada).toBe(false);
  });

  it('crear una nueva predeterminada también desmarca la anterior', async () => {
    const token = await tokenDeCliente();
    await crear(token, { esPredeterminada: true });

    await crear(token, { esPredeterminada: true });

    const lista = leerDatos(
      await request(app).get('/api/v1/direcciones').set(con(token)),
      listaSchema,
    );
    expect(lista.filter((d) => d.esPredeterminada)).toHaveLength(1);
  });

  it('marcar 5 direcciones como predeterminadas a la vez deja exactamente una, sin deadlocks', async () => {
    avisosDeDeadlock.length = 0;
    const token = await tokenDeCliente();
    await crear(token, { esPredeterminada: true });
    const ids: number[] = [];
    for (let i = 0; i < 5; i++)
      ids.push(leerDatos(await crear(token), direccionSchema).idDireccion);

    const respuestas = await Promise.all(
      ids.map((id) =>
        request(app)
          .patch(`/api/v1/direcciones/${String(id)}`)
          .set(con(token))
          .send({ esPredeterminada: true }),
      ),
    );

    expect(avisosDeDeadlock).toEqual([]);
    expect(respuestas.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const lista = leerDatos(
      await request(app).get('/api/v1/direcciones').set(con(token)),
      listaSchema,
    );
    expect(lista.filter((d) => d.esPredeterminada)).toHaveLength(1);
  });

  it('borrar y cambiar la predeterminada a la vez no produce deadlocks', async () => {
    avisosDeDeadlock.length = 0;
    const token = await tokenDeCliente();
    const ids: number[] = [];
    for (let i = 0; i < 6; i++) {
      ids.push(
        leerDatos(await crear(token, { esPredeterminada: i === 0 }), direccionSchema).idDireccion,
      );
    }
    const ruta = (id: number | undefined) => `/api/v1/direcciones/${String(id)}`;

    const respuestas = await Promise.all([
      request(app).delete(ruta(ids[0])).set(con(token)),
      request(app).patch(ruta(ids[1])).set(con(token)).send({ esPredeterminada: true }),
      request(app).delete(ruta(ids[2])).set(con(token)),
      request(app).patch(ruta(ids[3])).set(con(token)).send({ esPredeterminada: true }),
      request(app).delete(ruta(ids[4])).set(con(token)),
      request(app).patch(ruta(ids[5])).set(con(token)).send({ esPredeterminada: true }),
    ]);

    expect(avisosDeDeadlock).toEqual([]);
    expect(respuestas.map((r) => r.status)).toEqual([204, 200, 204, 200, 204, 200]);
    const lista = leerDatos(
      await request(app).get('/api/v1/direcciones').set(con(token)),
      listaSchema,
    );
    expect(lista).toHaveLength(3);
    expect(lista.filter((d) => d.esPredeterminada)).toHaveLength(1);
  });

  it('5 altas predeterminadas simultáneas dejan exactamente una, sin deadlocks', async () => {
    avisosDeDeadlock.length = 0;
    const token = await tokenDeCliente();
    await crear(token, { esPredeterminada: true });

    const respuestas = await Promise.all(
      Array.from({ length: 5 }, () => crear(token, { esPredeterminada: true })),
    );

    expect(avisosDeDeadlock).toEqual([]);
    expect(respuestas.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    const lista = leerDatos(
      await request(app).get('/api/v1/direcciones').set(con(token)),
      listaSchema,
    );
    expect(lista.filter((d) => d.esPredeterminada)).toHaveLength(1);
  });

  it('PATCH conserva lo que no llega y quita el alias con null', async () => {
    const token = await tokenDeCliente();
    const { idDireccion } = leerDatos(await crear(token, { alias: 'Oficina' }), direccionSchema);

    const respuesta = await request(app)
      .patch(`/api/v1/direcciones/${String(idDireccion)}`)
      .set(con(token))
      .send({ alias: null });

    expect(leerDatos(respuesta, direccionSchema)).toMatchObject({
      alias: null,
      nombreRecibe: 'Ana Pérez',
    });
  });

  it('PATCH simultáneos que tocan campos distintos conservan todos los cambios (la mezcla es del SP)', async () => {
    const token = await tokenDeCliente();
    const { idDireccion } = leerDatos(await crear(token, { alias: 'Casa' }), direccionSchema);
    const municipio = await idMunicipio('Guatemala', 'Villa Nueva');
    const cambios = [
      { alias: 'Oficina' },
      { nombreRecibe: 'Beto Gómez' },
      { telefonoRecibe: '44443333' },
      { idMunicipio: municipio },
      { direccionLinea: '6a calle 1-10, zona 4' },
      { referencia: 'Portón negro' },
    ];
    const ruta = `/api/v1/direcciones/${String(idDireccion)}`;

    await Promise.all(
      cambios.map((cambio) => request(app).patch(ruta).set(con(token)).send(cambio)),
    );

    expect(leerDatos(await request(app).get(ruta).set(con(token)), direccionSchema)).toMatchObject({
      alias: 'Oficina',
      nombreRecibe: 'Beto Gómez',
      telefonoRecibe: '44443333',
      municipio: { idMunicipio: municipio },
      direccionLinea: '6a calle 1-10, zona 4',
      referencia: 'Portón negro',
    });
  });

  it('N-17: un PATCH que no incluye la predeterminada nunca la cambia, aunque otra la tome a la vez', async () => {
    const token = await tokenDeCliente();
    const primera = leerDatos(await crear(token, { esPredeterminada: true }), direccionSchema);
    const segunda = leerDatos(await crear(token), direccionSchema);
    const ruta = (id: number) => `/api/v1/direcciones/${String(id)}`;

    await Promise.all([
      ...Array.from({ length: 5 }, (_, i) =>
        request(app)
          .patch(ruta(primera.idDireccion))
          .set(con(token))
          .send({ alias: `Casa ${String(i)}` }),
      ),
      request(app)
        .patch(ruta(segunda.idDireccion))
        .set(con(token))
        .send({ esPredeterminada: true }),
    ]);

    const lista = leerDatos(
      await request(app).get('/api/v1/direcciones').set(con(token)),
      listaSchema,
    );
    expect(lista.filter((d) => d.esPredeterminada).map((d) => d.idDireccion)).toEqual([
      segunda.idDireccion,
    ]);
  });

  it('la undécima dirección responde 422 LIMITE_DIRECCIONES', async () => {
    const token = await tokenDeCliente();
    for (let i = 0; i < 10; i++) expect((await crear(token)).status).toBe(201);

    const respuesta = await crear(token);

    expect(respuesta.status).toBe(422);
    expect(leerError(respuesta).codigo).toBe('LIMITE_DIRECCIONES');
  });

  it('con 8 direcciones, 5 altas simultáneas dejan exactamente 10 (el SP bloquea el conteo)', async () => {
    const token = await tokenDeCliente();
    for (let i = 0; i < 8; i++) await crear(token);

    const respuestas = await Promise.all(Array.from({ length: 5 }, () => crear(token)));

    expect(respuestas.filter((r) => r.status === 201)).toHaveLength(2);
    expect(respuestas.filter((r) => r.status === 422)).toHaveLength(3);
    const lista = leerDatos(
      await request(app).get('/api/v1/direcciones').set(con(token)),
      listaSchema,
    );
    expect(lista).toHaveLength(10);
  });

  it('un municipio inexistente responde 400', async () => {
    const respuesta = await crear(await tokenDeCliente(), { idMunicipio: 999999 });

    expect(respuesta.status).toBe(400);
  });

  it('RF-01: el cuerpo no acepta un idUsuario', async () => {
    const respuesta = await crear(await tokenDeCliente(), { idUsuario: 1 });

    expect(respuesta.status).toBe(400);
  });

  it('borrar responde 204 y la dirección ya no aparece', async () => {
    const token = await tokenDeCliente();
    const { idDireccion } = leerDatos(await crear(token), direccionSchema);

    const borrar = await request(app)
      .delete(`/api/v1/direcciones/${String(idDireccion)}`)
      .set(con(token));

    expect(borrar.status).toBe(204);
    expect(
      leerDatos(await request(app).get('/api/v1/direcciones').set(con(token)), listaSchema),
    ).toEqual([]);
  });

  it('un Operador no tiene direcciones (403) y sin token responde 401', async () => {
    const operador = leerSesion(await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'));

    expect(
      (await request(app).get('/api/v1/direcciones').set(con(operador.accessToken))).status,
    ).toBe(403);
    expect((await request(app).get('/api/v1/direcciones')).status).toBe(401);
  });
});

describe('catálogo geográfico público (E2-H05, N-17)', () => {
  it('GET /departamentos devuelve los 22 departamentos sin token', async () => {
    const respuesta = await request(app).get('/api/v1/departamentos');

    expect(respuesta.status).toBe(200);
    expect(leerDatos(respuesta, geografiaSchema)).toHaveLength(22);
  });

  it('GET /departamentos/:id/municipios devuelve los 17 municipios de Guatemala', async () => {
    const departamentos = leerDatos(
      await request(app).get('/api/v1/departamentos'),
      departamentosSchema,
    );
    const guatemala = departamentos.find((d) => d.nombre === 'Guatemala');

    const respuesta = await request(app).get(
      `/api/v1/departamentos/${String(guatemala?.idDepartamento)}/municipios`,
    );

    expect(leerDatos(respuesta, geografiaSchema)).toHaveLength(17);
  });

  it('un departamento inexistente responde 404', async () => {
    expect((await request(app).get('/api/v1/departamentos/999999/municipios')).status).toBe(404);
  });
});
