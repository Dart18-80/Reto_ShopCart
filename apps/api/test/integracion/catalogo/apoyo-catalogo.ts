import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import sql from 'mssql';
import request from 'supertest';
import { z } from 'zod';
import { leerDatos } from '../../unit/respuestas.js';
import { iniciarSesion, leerSesion } from '../auth/apoyo-auth.js';
import { comoActor, crearUsuario, unaFila } from '../datos-de-prueba.js';

export const sufijo = (): string => randomUUID().slice(0, 8);

export async function tokenDeAdmin(app: Express): Promise<string> {
  return leerSesion(await iniciarSesion(app, 'admin@shopcart.gt', 'Admin2026!')).accessToken;
}

export const conToken = (token: string) => ({ Authorization: `Bearer ${token}` });

const idSchema = z.object({ idCategoria: z.number() });

export async function crearCategoria(app: Express, token: string): Promise<number> {
  const respuesta = await request(app)
    .post('/api/v1/admin/categorias')
    .set(conToken(token))
    .send({ nombre: `Categoría ${sufijo()}` });
  return leerDatos(respuesta, idSchema).idCategoria;
}

/** Un atributo nuevo con sus valores; devuelve el ID de cada valor por su texto. */
export async function crearAtributo(
  app: Express,
  token: string,
  valores: string[],
  orden?: number,
): Promise<{ idAtributo: number; nombre: string; valores: Record<string, number> }> {
  const nombre = `Atributo ${sufijo()}`;
  const atributo = leerDatos(
    await request(app).post('/api/v1/admin/atributos').set(conToken(token)).send({ nombre, orden }),
    z.object({ idAtributo: z.number() }),
  );
  const ids: Record<string, number> = {};
  for (const valor of valores) {
    const creado = leerDatos(
      await request(app)
        .post(`/api/v1/admin/atributos/${String(atributo.idAtributo)}/valores`)
        .set(conToken(token))
        .send({ valor }),
      z.object({ idValorAtributo: z.number() }),
    );
    ids[valor] = creado.idValorAtributo;
  }
  return { idAtributo: atributo.idAtributo, nombre, valores: ids };
}

export const varianteAdminSchema = z.object({
  idVariante: z.number(),
  sku: z.string(),
  descripcionAtributos: z.string(),
  activo: z.boolean(),
  precio: z.string().nullable(),
  existenciaFisica: z.number(),
  reservado: z.number(),
  disponible: z.number(),
  valores: z.array(
    z.object({
      idAtributo: z.number(),
      atributo: z.string(),
      idValorAtributo: z.number(),
      valor: z.string(),
    }),
  ),
});

export const productoAdminSchema = z.object({
  idProducto: z.number(),
  idCategoria: z.number(),
  categoria: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  activo: z.boolean(),
  imagenes: z.array(
    z.object({
      idImagenProducto: z.number(),
      url: z.string(),
      textoAlternativo: z.string(),
      orden: z.number(),
      esPrincipal: z.boolean(),
    }),
  ),
  variantes: z.array(varianteAdminSchema),
});

export type ProductoAdminRecibido = z.infer<typeof productoAdminSchema>;

export async function crearProducto(
  app: Express,
  token: string,
  idCategoria: number,
  cambios: Record<string, unknown> = {},
): Promise<ProductoAdminRecibido> {
  const respuesta = await request(app)
    .post('/api/v1/admin/productos')
    .set(conToken(token))
    .send({ idCategoria, nombre: `Producto ${sufijo()}`, ...cambios });
  return leerDatos(respuesta, productoAdminSchema);
}

export function crearVariante(
  app: Express,
  token: string,
  idProducto: number,
  valores: number[],
  cambios: Record<string, unknown> = {},
) {
  return request(app)
    .post(`/api/v1/admin/productos/${String(idProducto)}/variantes`)
    .set(conToken(token))
    .send({ sku: `SKU-${sufijo()}`, valores, precio: '149.90', ...cambios });
}

/** Entrada de inventario directa (E3-H06 aún no existe): pasa por SP_Inventario_RegistrarMovimiento. */
export async function registrarEntrada(idVariante: number, cantidad: number) {
  // Todo movimiento necesita un usuario responsable.
  return comoActor(await crearUsuario(), 'Operador', () =>
    unaFila('SP_Pruebas_RegistrarMovimiento', {
      IDVariante: { tipo: sql.Int, valor: idVariante },
      CodigoTipo: { tipo: sql.VarChar(30), valor: 'EntradaCompra' },
      Cantidad: { tipo: sql.Int, valor: cantidad },
    }),
  );
}
