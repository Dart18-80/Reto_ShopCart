import sql from 'mssql';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerError } from '../../unit/respuestas.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  conToken,
  crearCategoria,
  crearProducto,
  crearVariante,
  registrarEntrada,
  sufijo,
  tokenDeAdmin,
} from './apoyo-catalogo.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());
// RNF-1: la búsqueda responde en menos de 1 s con la semilla.
const LIMITE_MS = 1000;

const resultadoSchema = z.object({
  datos: z.array(
    z.object({
      idProducto: z.number(),
      nombre: z.string(),
      idCategoria: z.number(),
      categoria: z.string(),
      ilustracion: z.string(),
      precioMinimo: z.string(),
      disponible: z.boolean(),
      imagenPrincipal: z.string().nullable(),
      colores: z.array(z.string()),
    }),
  ),
  paginacion: z.object({
    pagina: z.number(),
    tamano: z.number(),
    total: z.number(),
    totalPaginas: z.number(),
  }),
});

let token: string;

beforeAll(async () => {
  token = await tokenDeAdmin(app);
});

/** Un producto visible en la tienda: activo, con una variante con precio y, si se pide, existencia. */
async function productoEnTienda(
  idCategoria: number,
  nombre: string,
  { precio = '100.00', existencia = 10 }: { precio?: string; existencia?: number } = {},
) {
  const producto = await crearProducto(app, token, idCategoria, { nombre });
  const respuesta = await crearVariante(app, token, producto.idProducto, [], { precio });
  const idVariante = z
    .object({ datos: z.object({ variantes: z.array(z.object({ idVariante: z.number() })) }) })
    .parse(respuesta.body).datos.variantes[0]?.idVariante;
  if (existencia > 0) await registrarEntrada(idVariante ?? 0, existencia);
  return producto.idProducto;
}

const buscar = async (consulta: Record<string, string>) => {
  const respuesta = await request(app).get('/api/v1/productos').query(consulta);
  return resultadoSchema.parse(respuesta.body);
};
const nombres = async (consulta: Record<string, string>) =>
  (await buscar(consulta)).datos.map((producto) => producto.nombre);

describe('búsqueda del catálogo (E3-H05, A-10)', () => {
  it('CA: "camion" encuentra "Camión" (sin tildes ni mayúsculas) y es público', async () => {
    const marca = sufijo();
    await productoEnTienda(await crearCategoria(app, token), `Camión de juguete ${marca}`);

    expect(await nombres({ texto: `camion de juguete ${marca}` })).toEqual([
      `Camión de juguete ${marca}`,
    ]);
  });

  it('los comodines de LIKE del usuario se buscan literal: "50%", "a_b" y "[x" no traen de más', async () => {
    const marca = sufijo();
    const idCategoria = await crearCategoria(app, token);
    for (const nombre of ['50% off', '500 off', 'a_b', 'axb', '[x]', 'x']) {
      await productoEnTienda(idCategoria, `${marca} ${nombre}`);
    }

    expect(await nombres({ texto: `${marca} 50%` })).toEqual([`${marca} 50% off`]);
    expect(await nombres({ texto: `${marca} a_b` })).toEqual([`${marca} a_b`]);
    expect(await nombres({ texto: `${marca} [x` })).toEqual([`${marca} [x]`]);
    await productoEnTienda(idCategoria, `${marca} C:\\temp`);
    expect(await nombres({ texto: `${marca} C:\\` })).toEqual([`${marca} C:\\temp`]);
    // Sin escape, "%<marca>" traería los productos de la marca.
    expect((await buscar({ texto: `%${marca}` })).datos).toEqual([]);
  });

  it('filtra por categoría, rango de precio y disponibilidad', async () => {
    const idCategoria = await crearCategoria(app, token);
    const marca = sufijo();
    await productoEnTienda(idCategoria, `${marca} barato`, { precio: '50.00' });
    await productoEnTienda(idCategoria, `${marca} caro`, { precio: '500.00' });
    await productoEnTienda(idCategoria, `${marca} agotado`, { precio: '100.00', existencia: 0 });
    const categoria = String(idCategoria);

    expect(
      await nombres({ categoria, precioMin: '60', precioMax: '600', orden: 'precio' }),
    ).toEqual([`${marca} agotado`, `${marca} caro`]);
    expect(await nombres({ categoria, disponible: 'true', orden: 'precio' })).toEqual([
      `${marca} barato`,
      `${marca} caro`,
    ]);
    const [agotado] = (await buscar({ categoria, disponible: 'false' })).datos;
    expect(agotado).toMatchObject({ nombre: `${marca} agotado`, disponible: false });
  });

  it('ordena por precio, nombre y recientes en ambas direcciones; relevancia pone primero lo que empieza con el texto', async () => {
    const idCategoria = await crearCategoria(app, token);
    const categoria = String(idCategoria);
    // Empieza con Z: queda después de "B" y "C" en el orden por nombre, sea cual sea el sufijo.
    const marca = `Z${sufijo()}`;
    await productoEnTienda(idCategoria, `B ${marca}`, { precio: '30.00' });
    await productoEnTienda(idCategoria, `C ${marca}`, { precio: '10.00' });
    await productoEnTienda(idCategoria, `${marca} A`, { precio: '20.00' });

    expect(await nombres({ categoria, orden: 'precio', direccion: 'asc' })).toEqual([
      `C ${marca}`,
      `${marca} A`,
      `B ${marca}`,
    ]);
    expect(await nombres({ categoria, orden: 'nombre', direccion: 'desc' })).toEqual([
      `${marca} A`,
      `C ${marca}`,
      `B ${marca}`,
    ]);
    // recientes ordena siempre por FechaCreacion descendente; la dirección no aplica.
    expect(await nombres({ categoria, orden: 'recientes', direccion: 'asc' })).toEqual([
      `${marca} A`,
      `C ${marca}`,
      `B ${marca}`,
    ]);
    expect((await nombres({ categoria, texto: marca, orden: 'relevancia' }))[0]).toBe(`${marca} A`);
  });

  it('con empates de precio entre páginas, OFFSET no repite ni pierde productos (desempate por IDProducto)', async () => {
    const idCategoria = await crearCategoria(app, token);
    const marca = sufijo();
    const ids: number[] = [];
    // Mismo nombre y mismo precio: solo IDProducto los distingue.
    for (let i = 0; i < 5; i++) {
      ids.push(await productoEnTienda(idCategoria, `Empate ${marca}`, { precio: '25.00' }));
    }

    const vistos: number[] = [];
    for (const pagina of ['1', '2', '3']) {
      const resultado = await buscar({
        categoria: String(idCategoria),
        orden: 'precio',
        tamano: '2',
        pagina,
      });
      vistos.push(...resultado.datos.map((producto) => producto.idProducto));
    }

    expect(vistos).toEqual([...ids].sort((a, b) => a - b));
    for (const consulta of [
      { orden: 'precio', direccion: 'desc' },
      { orden: 'nombre', direccion: 'desc' },
    ]) {
      const paginas: number[] = [];
      for (const pagina of ['1', '2', '3']) {
        const resultado = await buscar({
          categoria: String(idCategoria),
          tamano: '2',
          pagina,
          ...consulta,
        });
        paginas.push(...resultado.datos.map((producto) => producto.idProducto));
        expect(resultado.paginacion).toMatchObject({ total: 5, totalPaginas: 3 });
      }
      expect(paginas).toEqual([...ids].sort((a, b) => a - b));
    }
  });

  it('relevancia sin texto (el orden por defecto) equivale a nombre ascendente', async () => {
    const idCategoria = await crearCategoria(app, token);
    const marca = sufijo();
    for (const nombre of ['Gamma', 'Alfa', 'Beta']) {
      await productoEnTienda(idCategoria, `${nombre} ${marca}`);
    }

    expect(await nombres({ categoria: String(idCategoria) })).toEqual([
      `Alfa ${marca}`,
      `Beta ${marca}`,
      `Gamma ${marca}`,
    ]);
  });

  it('N-06: los resultados nunca traen la existencia, y disponible=true excluye lo que está todo reservado', async () => {
    const idCategoria = await crearCategoria(app, token);
    const marca = sufijo();
    await productoEnTienda(idCategoria, `${marca} libre`, { existencia: 5 });
    const reservado = await productoEnTienda(idCategoria, `${marca} reservado`, { existencia: 2 });
    const variante = z
      .object({ datos: z.object({ variantes: z.array(z.object({ idVariante: z.number() })) }) })
      .parse(
        (
          await request(app)
            .get(`/api/v1/admin/productos/${String(reservado)}`)
            .set(conToken(token))
        ).body,
      ).datos.variantes[0];
    await ejecutarSP('SP_Pruebas_CrearReserva', {
      IDVariante: { tipo: sql.Int, valor: variante?.idVariante ?? 0 },
      Cantidad: { tipo: sql.Int, valor: 2 },
      MinutosParaVencer: { tipo: sql.Int, valor: 15 },
    });

    const respuesta = await request(app)
      .get('/api/v1/productos')
      .query({ categoria: String(idCategoria), disponible: 'true' });

    expect(resultadoSchema.parse(respuesta.body).datos.map((p) => p.nombre)).toEqual([
      `${marca} libre`,
    ]);
    expect(respuesta.text).not.toMatch(/"(existenciaFisica|reservado|unidadesRestantes)":/);
  });

  it('no muestra productos desactivados ni sin variantes activas', async () => {
    const idCategoria = await crearCategoria(app, token);
    const marca = sufijo();
    const visible = await productoEnTienda(idCategoria, `${marca} visible`);
    const oculto = await productoEnTienda(idCategoria, `${marca} oculto`);
    await crearProducto(app, token, idCategoria, { nombre: `${marca} sin variantes` });
    await request(app)
      .post(`/api/v1/admin/productos/${String(oculto)}/desactivar`)
      .set(conToken(token));

    const resultado = await buscar({ categoria: String(idCategoria) });

    expect(resultado.datos.map((p) => p.idProducto)).toEqual([visible]);
  });

  it('CA: un orden malicioso responde 400 en la validación y el SP lo rechaza con su lista blanca', async () => {
    const respuesta = await request(app)
      .get('/api/v1/productos')
      .query({ orden: 'nombre; DROP TABLE Producto' });
    const directo = ejecutarSP('SP_Catalogo_BuscarProductos', {
      Texto: { tipo: sql.NVarChar(150), valor: null },
      IDCategoria: { tipo: sql.Int, valor: null },
      PrecioMin: { tipo: sql.Decimal(12, 2), valor: null },
      PrecioMax: { tipo: sql.Decimal(12, 2), valor: null },
      Disponible: { tipo: sql.Bit, valor: null },
      Orden: { tipo: sql.VarChar(20), valor: 'nombre; DROP' },
      Direccion: { tipo: sql.VarChar(4), valor: 'asc' },
      Pagina: { tipo: sql.Int, valor: 1 },
      Tamano: { tipo: sql.Int, valor: 20 },
    });

    expect(respuesta.status).toBe(400);
    expect(leerError(respuesta).codigo).toBe('VALIDACION_FALLIDA');
    await expect(directo).rejects.toMatchObject({ codigo: 'PARAMETRO_INVALIDO' });
  });

  it('el tamaño de página tiene un máximo (100) y un rango de precio invertido responde 400', async () => {
    const respuestas = await Promise.all([
      request(app).get('/api/v1/productos').query({ tamano: '101' }),
      request(app).get('/api/v1/productos').query({ precioMin: '100', precioMax: '10' }),
      request(app).get('/api/v1/productos').query({ precioMin: '-1' }),
    ]);

    expect(respuestas.map((r) => r.status)).toEqual([400, 400, 400]);
  });

  it('CA: con la semilla responde en menos de 1 s y devuelve la paginación estándar', async () => {
    const consultas = [
      {},
      { texto: 'camisa' },
      { orden: 'precio', direccion: 'desc', tamano: '100' },
    ];

    for (const consulta of consultas) {
      const inicio = performance.now();
      const respuesta = await request(app).get('/api/v1/productos').query(consulta);
      const duracion = performance.now() - inicio;

      expect(respuesta.status).toBe(200);
      expect(duracion).toBeLessThan(LIMITE_MS);
      expect(resultadoSchema.parse(respuesta.body).paginacion.pagina).toBe(1);
    }
  });
});

const atributosSchema = z.object({
  datos: z.array(
    z.object({
      idAtributo: z.number(),
      nombre: z.string(),
      valores: z.array(z.object({ idValorAtributo: z.number(), valor: z.string() })),
    }),
  ),
});

/** Los atributos Color y Talla de la semilla (FE-16: el atributo llamado Color es el color de la prenda). */
async function atributosDeLaSemilla() {
  const { datos } = atributosSchema.parse(
    (await request(app).get('/api/v1/admin/atributos').set(conToken(token))).body,
  );
  const porNombre = (nombre: string) => {
    const atributo = datos.find((a) => a.nombre === nombre);
    if (atributo === undefined) throw new Error(`Falta el atributo ${nombre} de la semilla`);
    return atributo;
  };
  const talla = porNombre('Talla');
  const idTalla = (valor: string) => {
    const encontrado = talla.valores.find((v) => v.valor === valor)?.idValorAtributo;
    if (encontrado === undefined) throw new Error(`Falta la talla ${valor} de la semilla`);
    return encontrado;
  };
  return { idColor: porNombre('Color').idAtributo, idTalla };
}

/** Un color nuevo de la semilla con su orden de despliegue: único por prueba. */
async function colorNuevo(idColor: number, valor: string, orden: number): Promise<number> {
  const respuesta = await request(app)
    .post(`/api/v1/admin/atributos/${String(idColor)}/valores`)
    .set(conToken(token))
    .send({ valor, orden });
  return z.object({ datos: z.object({ idValorAtributo: z.number() }) }).parse(respuesta.body).datos
    .idValorAtributo;
}

const idVarianteCreada = (respuesta: { body: unknown }) =>
  z
    .object({ datos: z.object({ variantes: z.array(z.object({ idVariante: z.number() })) }) })
    .parse(respuesta.body)
    .datos.variantes.at(-1)?.idVariante ?? 0;

describe('presentación de la búsqueda (M2-H01, FE-15, FE-16)', () => {
  it('colores: sin repetidos, sin variantes inactivas y en el orden de ValorAtributo.Orden', async () => {
    const { idColor, idTalla } = await atributosDeLaSemilla();
    const marca = sufijo();
    const rojo = await colorNuevo(idColor, `Rojo ${marca}`, 900);
    const verde = await colorNuevo(idColor, `Verde ${marca}`, 800);
    const morado = await colorNuevo(idColor, `Morado ${marca}`, 700);
    const producto = await crearProducto(app, token, await crearCategoria(app, token), {
      nombre: `Camisa ${marca}`,
    });
    await crearVariante(app, token, producto.idProducto, [rojo, idTalla('S')]);
    await crearVariante(app, token, producto.idProducto, [rojo, idTalla('M')]);
    await crearVariante(app, token, producto.idProducto, [verde, idTalla('S')]);
    const inactiva = idVarianteCreada(
      await crearVariante(app, token, producto.idProducto, [morado, idTalla('S')]),
    );
    await request(app)
      .post(`/api/v1/admin/variantes/${String(inactiva)}/desactivar`)
      .set(conToken(token));

    const [encontrado] = (await buscar({ texto: `Camisa ${marca}` })).datos;

    expect(encontrado?.colores).toEqual([`Verde ${marca}`, `Rojo ${marca}`]);
  });

  it('colores: como mucho 5, los primeros por orden', async () => {
    const { idColor } = await atributosDeLaSemilla();
    const marca = sufijo();
    const producto = await crearProducto(app, token, await crearCategoria(app, token), {
      nombre: `Gorra ${marca}`,
    });
    for (const orden of [6, 5, 4, 3, 2, 1]) {
      const color = await colorNuevo(idColor, `Tono ${String(orden)} ${marca}`, 950 + orden);
      await crearVariante(app, token, producto.idProducto, [color]);
    }

    const [encontrado] = (await buscar({ texto: `Gorra ${marca}` })).datos;

    expect(encontrado?.colores).toEqual(
      [1, 2, 3, 4, 5].map((orden) => `Tono ${String(orden)} ${marca}`),
    );
  });

  it('un producto sin atributo Color responde colores: [] y trae la ilustración de su categoría', async () => {
    const marca = sufijo();
    const idCategoria = await crearCategoria(app, token);
    await request(app)
      .patch(`/api/v1/admin/categorias/${String(idCategoria)}`)
      .set(conToken(token))
      .send({ ilustracion: 'Tenis' });
    await productoEnTienda(idCategoria, `Tenis ${marca}`);

    const [encontrado] = (await buscar({ texto: `Tenis ${marca}` })).datos;

    expect(encontrado).toMatchObject({ colores: [], ilustracion: 'Tenis' });
  });

  it('un color con comillas y comas llega íntegro', async () => {
    const { idColor } = await atributosDeLaSemilla();
    const marca = sufijo();
    const valor = `Azul "noche", ${marca}`;
    const producto = await crearProducto(app, token, await crearCategoria(app, token), {
      nombre: `Chaqueta ${marca}`,
    });
    await crearVariante(app, token, producto.idProducto, [await colorNuevo(idColor, valor, 990)]);

    const [encontrado] = (await buscar({ texto: `Chaqueta ${marca}` })).datos;

    expect(encontrado?.colores).toEqual([valor]);
  });
});
