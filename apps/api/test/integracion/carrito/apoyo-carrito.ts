import { createHash } from 'node:crypto';
import type { Express } from 'express';
import sql from 'mssql';
import request, { type Response } from 'supertest';
import { z } from 'zod';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos } from '../../unit/respuestas.js';
import { leerSesion, registrar } from '../auth/apoyo-auth.js';

export const COOKIE_CARRITO = 'carrito_invitado';

const existenciaSchema = z.object({
  estado: z.enum(['Disponible', 'UltimasUnidades', 'Agotado']),
  unidadesRestantes: z.number().nullable(),
});

export const lineaSchema = z.strictObject({
  idLinea: z.number(),
  idVariante: z.number(),
  idProducto: z.number(),
  producto: z.string(),
  sku: z.string(),
  descripcionAtributos: z.string(),
  imagen: z.string().nullable(),
  ilustracion: z.enum(['Camisa', 'Pantalon', 'Vestido', 'Chaqueta', 'Tenis', 'Gorra']),
  color: z.string().nullable(),
  cantidad: z.number(),
  precioUnitario: z.string(),
  totalLinea: z.string(),
  totalComprable: z.string(),
  descuentoLinea: z.string(),
  estado: z.enum(['Disponible', 'CantidadExcedida', 'Agotado', 'NoDisponible']),
  ajustarA: z.number().nullable(),
  existencia: existenciaSchema,
  garantiaHasta: z.iso.datetime(),
  aviso: z
    .strictObject({
      tipo: z.enum(['PrecioGarantizado', 'BajoDePrecio', 'CambioDePrecio']),
      precioAnterior: z.string().nullable(),
    })
    .nullable(),
});

export const carritoSchema = z.strictObject({
  lineas: z.array(lineaSchema),
  resumen: z.strictObject({
    lineas: z.number(),
    unidades: z.number(),
    subtotal: z.string(),
    descuento: z.string(),
    total: z.string(),
    puedePagar: z.boolean(),
    cupon: z.strictObject({ codigo: z.string(), descripcion: z.string() }).nullable(),
    cuponRetirado: z
      .strictObject({ codigo: z.string(), motivo: z.string(), mensaje: z.string() })
      .nullable(),
    envioGratis: z
      .strictObject({ montoMinimo: z.string(), faltante: z.string(), alcanzado: z.boolean() })
      .nullable(),
  }),
});

export type CarritoRecibido = z.infer<typeof carritoSchema>;

export const leerCarrito = (respuesta: Response): CarritoRecibido =>
  leerDatos(respuesta, carritoSchema);

interface FilaVendible {
  IDProducto: number;
  IDVariante: number;
}

/** Variantes vendibles nuevas, cada una en su propio producto, con precio y existencia. */
export async function variantesVendibles(
  precio: string,
  existencia: number,
  cantidad = 1,
): Promise<FilaVendible[]> {
  return ejecutarSP<FilaVendible>('SP_Pruebas_CrearVarianteVendible', {
    Precio: { tipo: sql.Decimal(12, 2), valor: precio },
    Existencia: { tipo: sql.Int, valor: existencia },
    Variantes: { tipo: sql.Int, valor: cantidad },
  });
}

export async function varianteVendible(precio = '10.00', existencia = 10): Promise<FilaVendible> {
  const [fila] = await variantesVendibles(precio, existencia);
  if (fila === undefined)
    throw new Error('SP_Pruebas_CrearVarianteVendible no devolvió la variante');
  return fila;
}

export async function clienteNuevo(app: Express): Promise<{ token: string; idUsuario: number }> {
  const sesion = leerSesion(await registrar(app));
  return { token: sesion.accessToken, idUsuario: sesion.usuario.idUsuario };
}

/** Cabeceras de quien pide el carrito: un cliente (Bearer) o un invitado (cookie). */
export type Comprador = Record<string, string>;
export const comoCliente = (token: string): Comprador => ({ Authorization: `Bearer ${token}` });
export const comoInvitado = (token?: string): Comprador =>
  token === undefined ? {} : { Cookie: `${COOKIE_CARRITO}=${token}` };

export const agregar = (app: Express, comprador: Comprador, idVariante: number, cantidad = 1) =>
  request(app).post('/api/v1/carrito/lineas').set(comprador).send({ idVariante, cantidad });

export const verCarrito = (app: Express, comprador: Comprador) =>
  request(app).get('/api/v1/carrito').set(comprador);

export const cambiarCantidad = (
  app: Express,
  comprador: Comprador,
  idLinea: number,
  cantidad: number,
) =>
  request(app)
    .patch(`/api/v1/carrito/lineas/${String(idLinea)}`)
    .set(comprador)
    .send({ cantidad });

export const marcarAvisosVistos = (app: Express, comprador: Comprador) =>
  request(app).post('/api/v1/carrito/avisos/vistos').set(comprador);

export function vencerGarantia(idLinea: number) {
  return ejecutarSP('SP_Pruebas_VencerGarantiaCarrito', {
    IDLineaCarrito: { tipo: sql.Int, valor: idLinea },
  });
}

export const quitarLinea = (app: Express, comprador: Comprador, idLinea: number) =>
  request(app)
    .delete(`/api/v1/carrito/lineas/${String(idLinea)}`)
    .set(comprador);

/** El Set-Cookie del carrito de invitado, o undefined si la respuesta no lo trae. */
export function cookieCarrito(respuesta: Response): string | undefined {
  const cabecera: unknown = respuesta.headers['set-cookie'];
  const cookies = Array.isArray(cabecera) ? cabecera.filter((c) => typeof c === 'string') : [];
  return cookies.find((cookie) => cookie.startsWith(`${COOKIE_CARRITO}=`));
}

export function tokenCarrito(respuesta: Response): string {
  const valor = cookieCarrito(respuesta)
    ?.split(';')[0]
    ?.slice(COOKIE_CARRITO.length + 1);
  if (valor === undefined || valor.length === 0)
    throw new Error('La respuesta no trae la cookie del carrito');
  return decodeURIComponent(valor);
}

/** Un invitado nuevo con un carrito que ya tiene la variante; devuelve su token. */
export async function invitadoConCarrito(app: Express, idVariante: number, cantidad = 1) {
  const respuesta = await agregar(app, comoInvitado(), idVariante, cantidad);
  return { token: tokenCarrito(respuesta), carrito: leerCarrito(respuesta) };
}

export const hashDe = (token: string): Buffer => createHash('sha256').update(token).digest();

export interface FilaCarritoGuardado {
  IDCarrito: number;
  Estado: string;
  IDUsuario: number | null;
  Lineas: number;
}

export function carritosDelCliente(idUsuario: number): Promise<FilaCarritoGuardado[]> {
  return ejecutarSP<FilaCarritoGuardado>('SP_Pruebas_LeerCarritos', {
    IDUsuario: { tipo: sql.Int, valor: idUsuario },
  });
}

export function carritosConHash(hash: Buffer): Promise<FilaCarritoGuardado[]> {
  return ejecutarSP<FilaCarritoGuardado>('SP_Pruebas_LeerCarritos', {
    HashTokenInvitado: { tipo: sql.Binary, valor: hash },
  });
}

export function primeraLinea(carrito: CarritoRecibido) {
  const [linea] = carrito.lineas;
  if (linea === undefined) throw new Error('El carrito no tiene líneas');
  return linea;
}
