import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { crearApp } from '../../../src/app.js';
import { dependenciasDePrueba } from '../../app-de-prueba.js';
import { usarBaseDePruebas } from '../base-de-pruebas.js';
import {
  conToken,
  crearCategoria,
  crearProducto,
  crearVariante,
  registrarEntrada,
  tokenDeAdmin,
} from '../catalogo/apoyo-catalogo.js';
import { invitadoConCarrito, primeraLinea, varianteVendible } from './apoyo-carrito.js';

usarBaseDePruebas();

const app = crearApp(dependenciasDePrueba());

let token: string;

beforeAll(async () => {
  token = await tokenDeAdmin(app);
});

const atributosSchema = z.object({
  datos: z.array(
    z.object({
      nombre: z.string(),
      valores: z.array(z.object({ idValorAtributo: z.number(), valor: z.string() })),
    }),
  ),
});

/** El valor Azul del atributo Color de la semilla (FE-16). */
async function azulDeLaSemilla(): Promise<number> {
  const { datos } = atributosSchema.parse(
    (await request(app).get('/api/v1/admin/atributos').set(conToken(token))).body,
  );
  const azul = datos.find((a) => a.nombre === 'Color')?.valores.find((v) => v.valor === 'Azul');
  if (azul === undefined) throw new Error('Falta el color Azul de la semilla');
  return azul.idValorAtributo;
}

describe('ilustración y color de la línea del carrito (M3-H01, FE-15, FE-16)', () => {
  it('una variante Azul de una categoría Tenis responde ilustracion: Tenis y color: Azul', async () => {
    const idCategoria = await crearCategoria(app, token);
    await request(app)
      .patch(`/api/v1/admin/categorias/${String(idCategoria)}`)
      .set(conToken(token))
      .send({ ilustracion: 'Tenis' });
    const producto = await crearProducto(app, token, idCategoria);
    const idVariante = z
      .object({ datos: z.object({ variantes: z.array(z.object({ idVariante: z.number() })) }) })
      .parse((await crearVariante(app, token, producto.idProducto, [await azulDeLaSemilla()])).body)
      .datos.variantes[0]?.idVariante;
    if (idVariante === undefined) throw new Error('No se creó la variante');
    await registrarEntrada(idVariante, 5);

    const { carrito } = await invitadoConCarrito(app, idVariante);

    expect(primeraLinea(carrito)).toMatchObject({ ilustracion: 'Tenis', color: 'Azul' });
  });

  it('una variante sin atributo Color responde color: null', async () => {
    const { IDVariante } = await varianteVendible();

    const { carrito } = await invitadoConCarrito(app, IDVariante);

    expect(primeraLinea(carrito)).toMatchObject({ ilustracion: 'Camisa', color: null });
  });
});
