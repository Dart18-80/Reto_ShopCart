import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { iniciarSesion, leerSesion, registrar } from '../auth/apoyo-auth.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  conToken,
  crearAtributo,
  crearCategoria,
  crearProducto,
  crearVariante,
  productoAdminSchema,
  registrarEntrada,
  sufijo,
  tokenDeAdmin,
} from './apoyo-catalogo.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
const ADMIN = '/api/v1/admin/productos';
const ID_INEXISTENTE = 2_147_483_647;
// S001: UmbralUltimasUnidades de ParametroSistema.
const UMBRAL = 5;

let token: string;
const conAdmin = () => conToken(token);
const ruta = (idProducto: number, accion?: string) =>
  `${ADMIN}/${String(idProducto)}${accion === undefined ? '' : `/${accion}`}`;

beforeAll(async () => {
  token = await tokenDeAdmin(app);
});

const desactivarCategoria = (idCategoria: number) =>
  request(app)
    .post(`/api/v1/admin/categorias/${String(idCategoria)}/desactivar`)
    .set(conAdmin());

describe('productos y el invariante de categoría (E3-H03, N-14)', () => {
  it('el Admin crea un producto activo sin variantes ni imágenes', async () => {
    const idCategoria = await crearCategoria(app, token);

    const respuesta = await request(app)
      .post(ADMIN)
      .set(conAdmin())
      .send({ idCategoria, nombre: '  Camisa Oxford  ', descripcion: 'Algodón' });

    expect(respuesta.status).toBe(201);
    expect(leerDatos(respuesta, productoAdminSchema)).toMatchObject({
      idCategoria,
      nombre: 'Camisa Oxford',
      descripcion: 'Algodón',
      activo: true,
      imagenes: [],
      variantes: [],
    });
  });

  it('una categoría inexistente responde 400', async () => {
    const respuesta = await request(app)
      .post(ADMIN)
      .set(conAdmin())
      .send({ idCategoria: ID_INEXISTENTE, nombre: 'X' });

    expect(respuesta.status).toBe(400);
  });

  it('CATEGORIA_INACTIVA: crear activo en una categoría inactiva responde 409; inactivo sí se crea', async () => {
    const idCategoria = await crearCategoria(app, token);
    await desactivarCategoria(idCategoria);

    const activo = await request(app)
      .post(ADMIN)
      .set(conAdmin())
      .send({ idCategoria, nombre: 'A' });
    const inactivo = await request(app)
      .post(ADMIN)
      .set(conAdmin())
      .send({ idCategoria, nombre: 'B', activo: false });

    expect(activo.status).toBe(409);
    expect(leerError(activo).codigo).toBe('CATEGORIA_INACTIVA');
    expect(inactivo.status).toBe(201);
    expect(leerDatos(inactivo, productoAdminSchema).activo).toBe(false);
  });

  it('CATEGORIA_INACTIVA: activar un producto o mover uno activo a una categoría inactiva responde 409', async () => {
    const [activa, inactiva] = [await crearCategoria(app, token), await crearCategoria(app, token)];
    await desactivarCategoria(inactiva);
    const enInactiva = await crearProducto(app, token, inactiva, { activo: false });
    const activo = await crearProducto(app, token, activa);

    const activar = await request(app).post(ruta(enInactiva.idProducto, 'activar')).set(conAdmin());
    const mover = await request(app)
      .patch(ruta(activo.idProducto))
      .set(conAdmin())
      .send({ idCategoria: inactiva });

    for (const respuesta of [activar, mover]) {
      expect(respuesta.status).toBe(409);
      expect(leerError(respuesta).codigo).toBe('CATEGORIA_INACTIVA');
    }
  });

  it('activar productos mientras se desactiva su categoría nunca deja un producto activo en una categoría inactiva', async () => {
    const casos = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const idCategoria = await crearCategoria(app, token);
        const producto = await crearProducto(app, token, idCategoria, { activo: false });
        return { idCategoria, idProducto: producto.idProducto };
      }),
    );

    const respuestas = await Promise.all(
      casos.flatMap(({ idCategoria, idProducto }) => [
        desactivarCategoria(idCategoria),
        request(app).post(ruta(idProducto, 'activar')).set(conAdmin()),
      ]),
    );

    expect(respuestas.every((r) => r.status === 200 || r.status === 409)).toBe(true);
    for (const { idProducto } of casos) {
      const producto = leerDatos(
        await request(app).get(ruta(idProducto)).set(conAdmin()),
        productoAdminSchema,
      );
      const categorias = leerDatos(
        await request(app).get('/api/v1/categorias'),
        z.array(z.object({ idCategoria: z.number() })),
      );
      const categoriaActiva = categorias.some((c) => c.idCategoria === producto.idCategoria);
      expect(producto.activo && !categoriaActiva).toBe(false);
    }
  });

  it('crear o mover productos activos mientras se desactiva la categoría nunca deja un producto activo en ella', async () => {
    const casos = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const idCategoria = await crearCategoria(app, token);
        const otra = await crearProducto(app, token, await crearCategoria(app, token));
        return { idCategoria, idProductoAMover: otra.idProducto };
      }),
    );

    const respuestas = await Promise.all(
      casos.flatMap(({ idCategoria, idProductoAMover }) => [
        desactivarCategoria(idCategoria),
        request(app)
          .post(ADMIN)
          .set(conAdmin())
          .send({ idCategoria, nombre: `Nuevo ${sufijo()}` }),
        request(app).patch(ruta(idProductoAMover)).set(conAdmin()).send({ idCategoria }),
      ]),
    );

    expect(respuestas.every((r) => r.status !== 500)).toBe(true);
    const activas = new Set(
      leerDatos(
        await request(app).get('/api/v1/categorias'),
        z.array(z.object({ idCategoria: z.number() })),
      ).map((c) => c.idCategoria),
    );
    for (const { idCategoria } of casos) {
      const productos = z.object({ datos: z.array(z.looseObject({ activo: z.boolean() })) }).parse(
        (
          await request(app)
            .get(`${ADMIN}?categoria=${String(idCategoria)}&activo=true`)
            .set(conAdmin())
        ).body,
      ).datos;
      expect(productos.length > 0 && !activas.has(idCategoria)).toBe(false);
    }
  });

  it('PATCH cambia el nombre, quita la descripción con null y uno inexistente responde 404', async () => {
    const producto = await crearProducto(app, token, await crearCategoria(app, token), {
      descripcion: 'Antes',
    });
    const nombre = `Producto ${sufijo()}`;

    const editado = await request(app)
      .patch(ruta(producto.idProducto))
      .set(conAdmin())
      .send({ nombre, descripcion: null });
    const inexistente = await request(app)
      .patch(ruta(ID_INEXISTENTE))
      .set(conAdmin())
      .send({ nombre });

    expect(leerDatos(editado, productoAdminSchema)).toMatchObject({ nombre, descripcion: null });
    expect(inexistente.status).toBe(404);
  });
});

describe('imágenes del producto (E3-H03, N-19)', () => {
  const imagen = (orden: number, esPrincipal: boolean) => ({
    url: `/static/productos/${sufijo()}.svg`,
    textoAlternativo: `Vista ${String(orden)}`,
    orden,
    esPrincipal,
  });

  it('PUT guarda el conjunto en orden, con una principal, y una lista vacía las quita', async () => {
    const producto = await crearProducto(app, token, await crearCategoria(app, token));

    const guardadas = await request(app)
      .put(ruta(producto.idProducto, 'imagenes'))
      .set(conAdmin())
      .send({ imagenes: [imagen(2, false), imagen(1, true)] });
    const vacias = await request(app)
      .put(ruta(producto.idProducto, 'imagenes'))
      .set(conAdmin())
      .send({ imagenes: [] });

    const conImagenes = leerDatos(guardadas, productoAdminSchema).imagenes;
    expect(conImagenes.map((i) => [i.orden, i.esPrincipal])).toEqual([
      [1, true],
      [2, false],
    ]);
    expect(leerDatos(vacias, productoAdminSchema).imagenes).toEqual([]);
  });

  it('dos principales, ninguna principal u órdenes repetidos responden 400 y el conjunto anterior queda intacto', async () => {
    const producto = await crearProducto(app, token, await crearCategoria(app, token));
    const anteriores = [imagen(1, true)];
    await request(app)
      .put(ruta(producto.idProducto, 'imagenes'))
      .set(conAdmin())
      .send({ imagenes: anteriores });

    const invalidas = [
      [imagen(1, true), imagen(2, true)],
      [imagen(1, false)],
      [imagen(1, true), imagen(1, false)],
    ];
    for (const imagenes of invalidas) {
      const respuesta = await request(app)
        .put(ruta(producto.idProducto, 'imagenes'))
        .set(conAdmin())
        .send({ imagenes });
      expect(respuesta.status).toBe(400);
    }

    const detalle = leerDatos(
      await request(app).get(ruta(producto.idProducto)).set(conAdmin()),
      productoAdminSchema,
    );
    expect(detalle.imagenes.map((i) => i.url)).toEqual(anteriores.map((i) => i.url));
  });
});

describe('GET de administración (E3-H03)', () => {
  it('el detalle trae variantes inactivas con la existencia exacta', async () => {
    const atributo = await crearAtributo(app, token, ['S', 'M']);
    const producto = await crearProducto(app, token, await crearCategoria(app, token));
    const conVariantes = leerDatos(
      await crearVariante(app, token, producto.idProducto, [atributo.valores.S ?? 0]),
      productoAdminSchema,
    );
    const [variante] = conVariantes.variantes;
    await registrarEntrada(variante?.idVariante ?? 0, 12);
    await request(app)
      .post(`/api/v1/admin/variantes/${String(variante?.idVariante)}/desactivar`)
      .set(conAdmin());

    const detalle = leerDatos(
      await request(app).get(ruta(producto.idProducto)).set(conAdmin()),
      productoAdminSchema,
    );

    expect(detalle.variantes).toEqual([
      expect.objectContaining({
        activo: false,
        existenciaFisica: 12,
        reservado: 0,
        disponible: 12,
      }),
    ]);
  });

  it('lista paginada con filtros de categoría, estado y texto sin tildes ni mayúsculas', async () => {
    const idCategoria = await crearCategoria(app, token);
    const marca = sufijo();
    await crearProducto(app, token, idCategoria, { nombre: `Camión ${marca}` });
    await crearProducto(app, token, idCategoria, { nombre: `Bota ${marca}`, activo: false });

    const respuesta = await request(app)
      .get(`${ADMIN}?categoria=${String(idCategoria)}&activo=false&tamano=10`)
      .set(conAdmin());
    const porTexto = await request(app)
      .get(`${ADMIN}?texto=${encodeURIComponent(`CAMION ${marca}`)}`)
      .set(conAdmin());

    const listaSchema = z.object({
      datos: z.array(z.looseObject({ nombre: z.string(), activo: z.boolean() })),
      paginacion: z.object({ total: z.number(), tamano: z.number() }),
    });
    const filtrada = listaSchema.parse(respuesta.body);
    expect(filtrada.datos.map((p) => p.nombre)).toEqual([`Bota ${marca}`]);
    expect(filtrada.paginacion).toMatchObject({ total: 1, tamano: 10 });
    expect(listaSchema.parse(porTexto.body).datos.map((p) => p.nombre)).toEqual([
      `Camión ${marca}`,
    ]);
  });

  it('un texto con comodines de LIKE se busca literal: "%<marca>" no trae los productos de la marca', async () => {
    const marca = sufijo();
    await crearProducto(app, token, await crearCategoria(app, token), { nombre: `Gorra ${marca}` });

    const respuesta = await request(app)
      .get(`${ADMIN}?texto=${encodeURIComponent(`%${marca}`)}`)
      .set(conAdmin());

    expect(z.object({ datos: z.array(z.unknown()) }).parse(respuesta.body).datos).toEqual([]);
  });

  it('un producto inexistente responde 404', async () => {
    expect((await request(app).get(ruta(ID_INEXISTENTE)).set(conAdmin())).status).toBe(404);
  });
});

describe('GET /productos/:id público (E3-H03, N-06)', () => {
  const tiendaSchema = z.object({
    idProducto: z.number(),
    nombre: z.string(),
    variantes: z.array(z.looseObject({ idVariante: z.number(), estadoExistencia: z.string() })),
  });
  // Claves JSON, no valores: "Disponible" es un estado válido de estadoExistencia.
  const CAMPOS_PROHIBIDOS = /"(existenciaFisica|reservado|disponible)":/;

  async function productoConVariante(existencia: number) {
    const atributo = await crearAtributo(app, token, ['Único']);
    const producto = await crearProducto(app, token, await crearCategoria(app, token));
    const detalle = leerDatos(
      await crearVariante(app, token, producto.idProducto, [atributo.valores['Único'] ?? 0]),
      productoAdminSchema,
    );
    const idVariante = detalle.variantes[0]?.idVariante ?? 0;
    if (existencia > 0) await registrarEntrada(idVariante, existencia);
    return { idProducto: producto.idProducto, idVariante };
  }

  const reservar = (idVariante: number, cantidad: number) =>
    ejecutarSP('SP_Pruebas_CrearReserva', {
      IDVariante: { tipo: sql.Int, valor: idVariante },
      Cantidad: { tipo: sql.Int, valor: cantidad },
      MinutosParaVencer: { tipo: sql.Int, valor: 15 },
    });

  const tienda = (idProducto: number) =>
    request(app).get(`/api/v1/productos/${String(idProducto)}`);

  it('por encima del umbral: Disponible, sin ninguna cifra de existencia', async () => {
    const { idProducto } = await productoConVariante(UMBRAL + 10);

    const respuesta = await tienda(idProducto);

    const [variante] = leerDatos(respuesta, tiendaSchema).variantes;
    expect(variante).toMatchObject({ estadoExistencia: 'Disponible', precio: '149.90' });
    expect(variante).not.toHaveProperty('unidadesRestantes');
    expect(respuesta.text).not.toMatch(CAMPOS_PROHIBIDOS);
  });

  it('en el umbral: UltimasUnidades con las unidades restantes reales (N-06)', async () => {
    const { idProducto } = await productoConVariante(UMBRAL);

    const respuesta = await tienda(idProducto);

    const [variante] = leerDatos(respuesta, tiendaSchema).variantes;
    expect(variante).toMatchObject({
      estadoExistencia: 'UltimasUnidades',
      unidadesRestantes: UMBRAL,
    });
    expect(respuesta.text).not.toMatch(CAMPOS_PROHIBIDOS);
  });

  it('un disponible de umbral + 1 es Disponible y uno de 1 es UltimasUnidades', async () => {
    const encima = await productoConVariante(UMBRAL + 1);
    const una = await productoConVariante(1);

    const [disponible] = leerDatos(await tienda(encima.idProducto), tiendaSchema).variantes;
    const [ultima] = leerDatos(await tienda(una.idProducto), tiendaSchema).variantes;

    expect(disponible).toMatchObject({ estadoExistencia: 'Disponible' });
    expect(ultima).toMatchObject({ estadoExistencia: 'UltimasUnidades', unidadesRestantes: 1 });
  });

  it('con reservas, el estado y las unidades salen del disponible, nunca de la existencia física', async () => {
    const conReserva = await productoConVariante(UMBRAL + 3);
    const todoReservado = await productoConVariante(3);
    await reservar(conReserva.idVariante, 4);
    await reservar(todoReservado.idVariante, 3);

    const respuesta = await tienda(conReserva.idProducto);
    const [parcial] = leerDatos(respuesta, tiendaSchema).variantes;
    const [agotada] = leerDatos(await tienda(todoReservado.idProducto), tiendaSchema).variantes;

    expect(parcial).toMatchObject({
      estadoExistencia: 'UltimasUnidades',
      unidadesRestantes: UMBRAL - 1,
    });
    expect(agotada).toMatchObject({ estadoExistencia: 'Agotado' });
    expect(agotada).not.toHaveProperty('unidadesRestantes');
    expect(respuesta.text).not.toMatch(CAMPOS_PROHIBIDOS);
  });

  it('sin existencia: Agotado, sin cifra', async () => {
    const { idProducto } = await productoConVariante(0);

    const respuesta = await tienda(idProducto);

    const [variante] = leerDatos(respuesta, tiendaSchema).variantes;
    expect(variante).toMatchObject({ estadoExistencia: 'Agotado' });
    expect(variante).not.toHaveProperty('unidadesRestantes');
    expect(respuesta.text).not.toMatch(CAMPOS_PROHIBIDOS);
  });

  it('trae la ilustración de su categoría y el plazo de la garantía de precio configurado (M2-H01, N-02)', async () => {
    const { idProducto } = await productoConVariante(3);
    const idCategoria = leerDatos(
      await request(app)
        .get(`${ADMIN}/${String(idProducto)}`)
        .set(conAdmin()),
      z.object({ idCategoria: z.number() }),
    ).idCategoria;
    await request(app)
      .patch(`/api/v1/admin/categorias/${String(idCategoria)}`)
      .set(conAdmin())
      .send({ ilustracion: 'Vestido' });
    const { diasGarantiaPrecio } = leerDatos(
      await request(app).get('/api/v1/admin/configuracion').set(conAdmin()),
      z.object({ diasGarantiaPrecio: z.number() }),
    );

    const respuesta = await tienda(idProducto);

    expect(respuesta.body).toMatchObject({ datos: { ilustracion: 'Vestido', diasGarantiaPrecio } });
  });

  it('un producto desactivado, o sin variantes activas, responde 404 en la tienda', async () => {
    const desactivado = await productoConVariante(3);
    const sinVariantesActivas = await productoConVariante(3);
    await request(app).post(ruta(desactivado.idProducto, 'desactivar')).set(conAdmin());
    await request(app)
      .post(`/api/v1/admin/variantes/${String(sinVariantesActivas.idVariante)}/desactivar`)
      .set(conAdmin());
    const sinVariantes = await crearProducto(app, token, await crearCategoria(app, token));

    for (const idProducto of [
      desactivado.idProducto,
      sinVariantesActivas.idProducto,
      sinVariantes.idProducto,
    ]) {
      expect((await tienda(idProducto)).status).toBe(404);
    }
  });
});

describe('roles en las rutas de productos (RF-01)', () => {
  it('un Cliente o un Operador recibe 403 en cada ruta de administración, y sin token 401', async () => {
    const producto = await crearProducto(app, token, await crearCategoria(app, token));
    const cliente = leerSesion(await registrar(app)).accessToken;
    const operador = leerSesion(
      await iniciarSesion(app, 'operador@shopcart.gt', 'Operador2026!'),
    ).accessToken;
    const id = producto.idProducto;
    const intentos = (cabeceras: Record<string, string>) => [
      request(app).get(ADMIN).set(cabeceras),
      request(app).get(ruta(id)).set(cabeceras),
      request(app).post(ADMIN).set(cabeceras).send({ idCategoria: 1, nombre: 'X' }),
      request(app).patch(ruta(id)).set(cabeceras).send({ nombre: 'X' }),
      request(app).post(ruta(id, 'activar')).set(cabeceras),
      request(app).post(ruta(id, 'desactivar')).set(cabeceras),
      request(app).put(ruta(id, 'imagenes')).set(cabeceras).send({ imagenes: [] }),
      request(app).delete(ruta(id)).set(cabeceras),
      request(app)
        .post(ruta(id, 'variantes'))
        .set(cabeceras)
        .send({ sku: 'X', valores: [], precio: '1.00' }),
      request(app).patch('/api/v1/admin/variantes/1').set(cabeceras).send({ sku: 'X' }),
      request(app).post('/api/v1/admin/variantes/1/activar').set(cabeceras),
      request(app).post('/api/v1/admin/variantes/1/desactivar').set(cabeceras),
      request(app).delete('/api/v1/admin/variantes/1').set(cabeceras),
    ];

    for (const credencial of [cliente, operador]) {
      for (const respuesta of await Promise.all(intentos(conToken(credencial)))) {
        expect(respuesta.status).toBe(403);
      }
    }
    for (const respuesta of await Promise.all(intentos({}))) expect(respuesta.status).toBe(401);
  });
});
