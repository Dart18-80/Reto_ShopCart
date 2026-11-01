import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos, leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import { crearPedido, crearUsuario } from '../datos-de-prueba.js';
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
const ID_INEXISTENTE = 2_147_483_647;

let token: string;
let talla: Awaited<ReturnType<typeof crearAtributo>>;
let color: Awaited<ReturnType<typeof crearAtributo>>;

beforeAll(async () => {
  token = await tokenDeAdmin(app);
  // Talla antes que Color en el orden de despliegue: la descripción queda "M / Azul".
  talla = await crearAtributo(app, token, ['S', 'M', 'L'], 1);
  color = await crearAtributo(app, token, ['Azul', 'Rojo'], 2);
});

const id = (valores: Record<string, number>, clave: string): number => valores[clave] ?? 0;
const rutaVariante = (idVariante: number, accion?: string) =>
  `/api/v1/admin/variantes/${String(idVariante)}${accion === undefined ? '' : `/${accion}`}`;

async function productoNuevo() {
  return (await crearProducto(app, token, await crearCategoria(app, token))).idProducto;
}

async function varianteNueva(idProducto: number, valores: number[]) {
  const detalle = leerDatos(
    await crearVariante(app, token, idProducto, valores),
    productoAdminSchema,
  );
  const ultima = detalle.variantes.at(-1);
  if (ultima === undefined) throw new Error('La variante no se creó');
  return ultima;
}

describe('alta de variantes (E3-H03, N-14)', () => {
  it('nace con el precio inicial, existencia 0, firma canónica y descripción por el orden de los atributos', async () => {
    const idProducto = await productoNuevo();

    const respuesta = await crearVariante(app, token, idProducto, [
      id(color.valores, 'Azul'),
      id(talla.valores, 'M'),
    ]);

    expect(respuesta.status).toBe(201);
    const [variante] = leerDatos(respuesta, productoAdminSchema).variantes;
    expect(variante).toMatchObject({
      descripcionAtributos: 'M / Azul',
      precio: '149.90',
      existenciaFisica: 0,
      reservado: 0,
      activo: true,
    });
    expect(variante?.valores.map((v) => v.valor)).toEqual(['M', 'Azul']);
  });

  it('la misma combinación en otro orden responde 409 COMBINACION_DUPLICADA; un SKU repetido, 409 SKU_DUPLICADO', async () => {
    const idProducto = await productoNuevo();
    const primera = await varianteNueva(idProducto, [
      id(talla.valores, 'S'),
      id(color.valores, 'Rojo'),
    ]);

    const combinacion = await crearVariante(app, token, idProducto, [
      id(color.valores, 'Rojo'),
      id(talla.valores, 'S'),
    ]);
    const sku = await crearVariante(
      app,
      token,
      idProducto,
      [id(talla.valores, 'L'), id(color.valores, 'Rojo')],
      { sku: primera.sku },
    );

    expect(combinacion.status).toBe(409);
    expect(leerError(combinacion).codigo).toBe('COMBINACION_DUPLICADA');
    expect(sku.status).toBe(409);
    expect(leerError(sku).codigo).toBe('SKU_DUPLICADO');
  });

  it('dos altas simultáneas de la misma combinación o del mismo SKU: una 201 y otra 409, nunca 500', async () => {
    const idProducto = await productoNuevo();
    const valores = [id(talla.valores, 'M'), id(color.valores, 'Rojo')];
    const sku = `SKU-${sufijo()}`;
    const otroProducto = await productoNuevo();

    const porCombinacion = await Promise.all([
      crearVariante(app, token, idProducto, valores),
      crearVariante(app, token, idProducto, valores),
    ]);
    const porSku = await Promise.all([
      crearVariante(app, token, otroProducto, [id(talla.valores, 'S')], { sku }),
      crearVariante(app, token, otroProducto, [id(talla.valores, 'L')], { sku }),
    ]);

    expect(porCombinacion.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(porSku.map((r) => r.status).sort()).toEqual([201, 409]);
    const codigo = (respuestas: typeof porSku) =>
      leerError(respuestas.find((r) => r.status === 409) ?? respuestas[0]).codigo;
    expect(codigo(porCombinacion)).toBe('COMBINACION_DUPLICADA');
    expect(codigo(porSku)).toBe('SKU_DUPLICADO');
    const detalle = await request(app)
      .get(`/api/v1/admin/productos/${String(idProducto)}`)
      .set(conToken(token));
    expect(leerDatos(detalle, productoAdminSchema).variantes).toHaveLength(1);
  });

  it('un valor inexistente, dos valores del mismo atributo o un valor repetido responden 400', async () => {
    const idProducto = await productoNuevo();

    const respuestas = await Promise.all([
      crearVariante(app, token, idProducto, [ID_INEXISTENTE]),
      crearVariante(app, token, idProducto, [id(talla.valores, 'S'), id(talla.valores, 'M')]),
      crearVariante(app, token, idProducto, [id(talla.valores, 'S'), id(talla.valores, 'S')]),
    ]);

    for (const respuesta of respuestas) {
      expect(respuesta.status).toBe(400);
      expect(leerError(respuesta).codigo).toBe('PARAMETRO_INVALIDO');
    }
  });

  it('un precio de cero o un producto inexistente se rechazan', async () => {
    const cero = await crearVariante(app, token, await productoNuevo(), [], { precio: '0.00' });
    const inexistente = await crearVariante(app, token, ID_INEXISTENTE, []);

    expect(cero.status).toBe(400);
    expect(inexistente.status).toBe(404);
  });
});

describe('conjunto de atributos del producto (N-14)', () => {
  it('una variante con otro conjunto responde 422 ATRIBUTOS_NO_COINCIDEN con los esperados', async () => {
    const idProducto = await productoNuevo();
    await varianteNueva(idProducto, [id(talla.valores, 'S'), id(color.valores, 'Azul')]);

    const respuesta = await crearVariante(app, token, idProducto, [id(talla.valores, 'M')]);

    expect(respuesta.status).toBe(422);
    const error = leerError(respuesta);
    expect(error.codigo).toBe('ATRIBUTOS_NO_COINCIDEN');
    expect(error.detalles).toEqual({
      atributosEsperados: [
        { idAtributo: talla.idAtributo, nombre: talla.nombre },
        { idAtributo: color.idAtributo, nombre: color.nombre },
      ],
    });
  });

  it('el conjunto lo fijan también las variantes inactivas', async () => {
    const idProducto = await productoNuevo();
    const inactiva = await varianteNueva(idProducto, [id(talla.valores, 'S')]);
    await request(app).post(rutaVariante(inactiva.idVariante, 'desactivar')).set(conToken(token));

    const respuesta = await crearVariante(app, token, idProducto, [id(color.valores, 'Azul')]);

    expect(leerError(respuesta).codigo).toBe('ATRIBUTOS_NO_COINCIDEN');
  });

  it('dos altas simultáneas con conjuntos distintos sobre un producto sin variantes: una 201 y otra 422', async () => {
    const idProducto = await productoNuevo();

    const respuestas = await Promise.all([
      crearVariante(app, token, idProducto, [id(talla.valores, 'S')]),
      crearVariante(app, token, idProducto, [id(color.valores, 'Azul')]),
    ]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 422]);
    const rechazo = respuestas.find((r) => r.status === 422) ?? respuestas[0];
    expect(leerError(rechazo).codigo).toBe('ATRIBUTOS_NO_COINCIDEN');
  });

  it('la única variante del producto sí puede cambiar a otro conjunto de atributos', async () => {
    const idProducto = await productoNuevo();
    const unica = await varianteNueva(idProducto, [id(talla.valores, 'S')]);

    const respuesta = await request(app)
      .patch(rutaVariante(unica.idVariante))
      .set(conToken(token))
      .send({ valores: [id(color.valores, 'Azul')] });

    expect(leerDatos(respuesta, productoAdminSchema).variantes[0]?.descripcionAtributos).toBe(
      'Azul',
    );
  });

  it('un producto admite una sola variante sin atributos ("Única"); una segunda responde 409', async () => {
    const idProducto = await productoNuevo();

    const unica = await crearVariante(app, token, idProducto, []);
    const segunda = await crearVariante(app, token, idProducto, []);
    const conAtributos = await crearVariante(app, token, idProducto, [id(talla.valores, 'S')]);

    expect(leerDatos(unica, productoAdminSchema).variantes[0]?.descripcionAtributos).toBe('Única');
    expect(leerError(segunda).codigo).toBe('COMBINACION_DUPLICADA');
    expect(leerError(conAtributos).codigo).toBe('ATRIBUTOS_NO_COINCIDEN');
  });

  it('si el producto se queda sin variantes, el conjunto se libera', async () => {
    const idProducto = await productoNuevo();
    const unica = await varianteNueva(idProducto, [id(talla.valores, 'S')]);
    await request(app).delete(rutaVariante(unica.idVariante)).set(conToken(token));

    const respuesta = await crearVariante(app, token, idProducto, [id(color.valores, 'Rojo')]);

    expect(respuesta.status).toBe(201);
  });
});

describe('edición de variantes (N-14)', () => {
  it('sin historial cambia la combinación dentro del conjunto y recalcula la descripción', async () => {
    const idProducto = await productoNuevo();
    const variante = await varianteNueva(idProducto, [
      id(talla.valores, 'S'),
      id(color.valores, 'Azul'),
    ]);

    const respuesta = await request(app)
      .patch(rutaVariante(variante.idVariante))
      .set(conToken(token))
      .send({ valores: [id(talla.valores, 'L'), id(color.valores, 'Azul')] });

    expect(leerDatos(respuesta, productoAdminSchema).variantes[0]?.descripcionAtributos).toBe(
      'L / Azul',
    );
  });

  it('con historial la combinación responde 409 VARIANTE_CON_HISTORIAL, pero el SKU sí se cambia', async () => {
    const idProducto = await productoNuevo();
    const variante = await varianteNueva(idProducto, [id(talla.valores, 'S')]);
    await registrarEntrada(variante.idVariante, 3);
    const sku = `SKU-${sufijo()}`;

    const combinacion = await request(app)
      .patch(rutaVariante(variante.idVariante))
      .set(conToken(token))
      .send({ valores: [id(talla.valores, 'M')] });
    const nuevoSku = await request(app)
      .patch(rutaVariante(variante.idVariante))
      .set(conToken(token))
      .send({ sku });

    expect(combinacion.status).toBe(409);
    expect(leerError(combinacion).codigo).toBe('VARIANTE_CON_HISTORIAL');
    expect(leerDatos(nuevoSku, productoAdminSchema).variantes[0]?.sku).toBe(sku);
  });

  it('cambiar a otro conjunto con más variantes en el producto responde 422', async () => {
    const idProducto = await productoNuevo();
    const variante = await varianteNueva(idProducto, [id(talla.valores, 'S')]);
    await varianteNueva(idProducto, [id(talla.valores, 'M')]);

    const respuesta = await request(app)
      .patch(rutaVariante(variante.idVariante))
      .set(conToken(token))
      .send({ valores: [id(color.valores, 'Azul')] });

    expect(leerError(respuesta).codigo).toBe('ATRIBUTOS_NO_COINCIDEN');
  });
});

describe('borrado con historial (N-14)', () => {
  async function conHistorial(tipo: 'kardex' | 'reserva' | 'venta') {
    const idProducto = await productoNuevo();
    const variante = await varianteNueva(idProducto, [id(talla.valores, 'S')]);
    if (tipo === 'kardex') await registrarEntrada(variante.idVariante, 5);
    if (tipo === 'reserva') {
      await ejecutarSP('SP_Pruebas_CrearReserva', {
        IDVariante: { tipo: sql.Int, valor: variante.idVariante },
        Cantidad: { tipo: sql.Int, valor: 1 },
        MinutosParaVencer: { tipo: sql.Int, valor: 15 },
      });
    }
    if (tipo === 'venta') {
      await ejecutarSP('SP_Pruebas_CrearDetallePedido', {
        IDPedido: { tipo: sql.Int, valor: await crearPedido(await crearUsuario()) },
        IDVariante: { tipo: sql.Int, valor: variante.idVariante },
        Cantidad: { tipo: sql.Int, valor: 1 },
      });
    }
    return { idProducto, idVariante: variante.idVariante };
  }

  it.each(['kardex', 'reserva', 'venta'] as const)(
    'con %s, ni la variante ni el producto se borran (409 PRODUCTO_CON_HISTORIAL) y se pueden desactivar',
    async (tipo) => {
      const { idProducto, idVariante } = await conHistorial(tipo);

      const variante = await request(app).delete(rutaVariante(idVariante)).set(conToken(token));
      const producto = await request(app)
        .delete(`/api/v1/admin/productos/${String(idProducto)}`)
        .set(conToken(token));
      const desactivar = await request(app)
        .post(rutaVariante(idVariante, 'desactivar'))
        .set(conToken(token));

      for (const respuesta of [variante, producto]) {
        expect(respuesta.status).toBe(409);
        expect(leerError(respuesta).codigo).toBe('PRODUCTO_CON_HISTORIAL');
      }
      expect(desactivar.status).toBe(200);
    },
  );

  it('sin historial se borra con sus líneas de carrito, imágenes, valores y precios (204)', async () => {
    const idProducto = await productoNuevo();
    const variante = await varianteNueva(idProducto, [id(talla.valores, 'S')]);
    await ejecutarSP('SP_Pruebas_CrearLineaCarrito', {
      IDUsuario: { tipo: sql.Int, valor: await crearUsuario() },
      IDVariante: { tipo: sql.Int, valor: variante.idVariante },
    });
    await request(app)
      .put(`/api/v1/admin/productos/${String(idProducto)}/imagenes`)
      .set(conToken(token))
      .send({
        imagenes: [{ url: '/static/x.svg', textoAlternativo: 'X', orden: 1, esPrincipal: true }],
      });

    const respuesta = await request(app)
      .delete(`/api/v1/admin/productos/${String(idProducto)}`)
      .set(conToken(token));
    const despues = await request(app)
      .get(`/api/v1/admin/productos/${String(idProducto)}`)
      .set(conToken(token));

    expect(respuesta.status).toBe(204);
    expect(despues.status).toBe(404);
  });

  it('una variante inexistente responde 404', async () => {
    const respuestas = await Promise.all([
      request(app).delete(rutaVariante(ID_INEXISTENTE)).set(conToken(token)),
      request(app).patch(rutaVariante(ID_INEXISTENTE)).set(conToken(token)).send({ sku: 'X-1' }),
      request(app).post(rutaVariante(ID_INEXISTENTE, 'activar')).set(conToken(token)),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([404, 404, 404]);
  });
});

describe('validación de entrada de variantes', () => {
  it('un SKU con espacios o no ASCII, más de 4 valores o un precio con tres decimales responden 400', async () => {
    const idProducto = await productoNuevo();

    const respuestas = await Promise.all([
      crearVariante(app, token, idProducto, [], { sku: 'SKU CON ESPACIO' }),
      crearVariante(app, token, idProducto, [], { sku: 'SKU-Ñ' }),
      crearVariante(app, token, idProducto, [1, 2, 3, 4, 5]),
      crearVariante(app, token, idProducto, [], { precio: '1.999' }),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([400, 400, 400, 400]);
    expect(
      z.array(z.unknown()).parse(
        leerDatos(
          await request(app)
            .get(`/api/v1/admin/productos/${String(idProducto)}`)
            .set(conToken(token)),
          productoAdminSchema,
        ).variantes,
      ),
    ).toEqual([]);
  });
});
