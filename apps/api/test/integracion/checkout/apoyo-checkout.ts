import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import sql from 'mssql';
import request, { type Response } from 'supertest';
import { z } from 'zod';
import { ejecutarSP } from '../../../src/shared/db/index.js';
import { leerDatos } from '../../unit/respuestas.js';
import { leerSesion, registrar } from '../auth/apoyo-auth.js';
import { agregar, comoCliente } from '../carrito/apoyo-carrito.js';

export const sesionPagoSchema = z.object({
  idSesion: z.number(),
  expiraEn: z.string(),
  direccion: z.looseObject({ nombreRecibe: z.string(), municipio: z.string() }),
  envio: z.object({
    idMetodoEnvio: z.number(),
    nombre: z.string(),
    diasMin: z.number(),
    diasMax: z.number(),
    costo: z.string(),
  }),
  codigoCupon: z.string().nullable(),
  lineas: z.array(
    z.looseObject({
      idVariante: z.number(),
      cantidad: z.number(),
      precioUnitario: z.string(),
      descuentoLinea: z.string(),
      totalLinea: z.string(),
    }),
  ),
  subtotal: z.string(),
  descuento: z.string(),
  total: z.string(),
  intentosRechazados: z.number(),
});

export type SesionPagoRecibida = z.infer<typeof sesionPagoSchema>;

export const leerSesionPago = (respuesta: Response): SesionPagoRecibida =>
  leerDatos(respuesta, sesionPagoSchema);

const idSchema = z.array(z.object({ idDepartamento: z.number() }));
const municipiosSchema = z.array(z.object({ idMunicipio: z.number() }));

async function municipioCualquiera(app: Express): Promise<number> {
  const [departamento] = leerDatos(await request(app).get('/api/v1/departamentos'), idSchema);
  const [municipio] = leerDatos(
    await request(app).get(
      `/api/v1/departamentos/${String(departamento?.idDepartamento)}/municipios`,
    ),
    municipiosSchema,
  );
  if (municipio === undefined) throw new Error('La semilla no tiene municipios');
  return municipio.idMunicipio;
}

export interface ClienteDePrueba {
  token: string;
  idUsuario: number;
  idDireccion: number;
}

/** Un cliente nuevo con una dirección. */
export async function clienteConDireccion(app: Express): Promise<ClienteDePrueba> {
  const sesion = leerSesion(await registrar(app));
  const idDireccion = await nuevaDireccion(app, sesion.accessToken);
  return { token: sesion.accessToken, idUsuario: sesion.usuario.idUsuario, idDireccion };
}

export async function nuevaDireccion(
  app: Express,
  token: string,
  linea = '5a avenida 10-20',
): Promise<number> {
  const respuesta = await request(app)
    .post('/api/v1/direcciones')
    .set(comoCliente(token))
    .send({
      nombreRecibe: 'Ana Pérez',
      telefonoRecibe: '55554444',
      idMunicipio: await municipioCualquiera(app),
      direccionLinea: linea,
    });
  return leerDatos(respuesta, z.object({ idDireccion: z.number() })).idDireccion;
}

export async function metodoEnvio(app: Express, codigo = 'Estandar'): Promise<number> {
  const respuesta = await request(app).get('/api/v1/envios/metodos');
  const metodos = leerDatos(
    respuesta,
    z.object({ metodos: z.array(z.object({ idMetodoEnvio: z.number(), codigo: z.string() })) }),
  ).metodos;
  const metodo = metodos.find((m) => m.codigo === codigo);
  if (metodo === undefined) throw new Error(`Falta el método ${codigo}`);
  return metodo.idMetodoEnvio;
}

export const iniciarPago = (
  app: Express,
  cliente: ClienteDePrueba,
  idMetodoEnvio: number,
  idDireccion = cliente.idDireccion,
) =>
  request(app)
    .post('/api/v1/checkout/sesion')
    .set(comoCliente(cliente.token))
    .send({ idDireccion, idMetodoEnvio });

/** Un cliente con dirección y un carrito con las variantes y cantidades dadas. */
export async function clienteConCarrito(
  app: Express,
  lineas: { idVariante: number; cantidad: number }[],
): Promise<ClienteDePrueba> {
  const cliente = await clienteConDireccion(app);
  for (const { idVariante, cantidad } of lineas) {
    await agregar(app, comoCliente(cliente.token), idVariante, cantidad);
  }
  return cliente;
}

export interface FilaReserva {
  IDVariante: number;
  Cantidad: number;
  Estado: string;
}

export function reservasDe(idSesion: number): Promise<FilaReserva[]> {
  return ejecutarSP<FilaReserva>('SP_Pruebas_LeerReservasSesion', {
    IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
  });
}

export const TARJETA_APROBADA = '4242424242424242';
export const TARJETA_RECHAZADA = '4000000000000002';
export const TARJETA_TIEMPO_AGOTADO = '4000000000000119';

export const pagar = (
  app: Express,
  token: string,
  llave: string,
  numeroTarjeta = TARJETA_APROBADA,
) =>
  request(app)
    .post('/api/v1/checkout/sesion/pagos')
    .set({ ...comoCliente(token), 'Idempotency-Key': llave })
    .send({ numeroTarjeta, mesVencimiento: 12, anioVencimiento: 2030, cvv: '731' });

export const pedidoSchema = z.object({
  idPedido: z.number(),
  numeroPedido: z.string(),
  estado: z.string(),
  subtotal: z.string(),
  descuento: z.string(),
  costoEnvio: z.string(),
  total: z.string(),
  baseImponible: z.string(),
  iva: z.string(),
  codigoCupon: z.string().nullable(),
  fechaPago: z.string(),
  fechaPagoLocal: z.string(),
  tarjeta: z.object({ marca: z.string(), ultimosDigitos: z.string() }),
  lineas: z.array(z.looseObject({ idVariante: z.number(), sku: z.string(), cantidad: z.number() })),
});

export const leerPedido = (respuesta: Response) => leerDatos(respuesta, pedidoSchema);

export interface FilaIntento {
  IDIntentoPago: string;
  IDSesionCheckout: number;
  LlaveIdempotencia: string;
  Estado: string;
  CodigoRespuesta: string | null;
  IDTransaccionPasarela: string | null;
  Arrendado: boolean;
  TokenArrendamiento: string | null;
}

export function intentosDe(idSesion: number): Promise<FilaIntento[]> {
  return ejecutarSP<FilaIntento>('SP_Pruebas_LeerIntentosPago', {
    IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
  });
}

export function moverArrendamiento(idIntento: string, segundos: number) {
  return ejecutarSP('SP_Pruebas_MoverArrendamiento', {
    IDIntentoPago: { tipo: sql.BigInt, valor: idIntento },
    Segundos: { tipo: sql.Int, valor: segundos },
  });
}

export interface PagoDeSesion {
  Pedidos: number;
  Detalles: number;
  SalidasKardex: number;
  Historial: number;
  EstadoUsoCupon: string | null;
  EstadoSesion: string;
  EstadoCarrito: string;
  EstadoReserva: string | null;
}

export async function pagoDe(idSesion: number): Promise<PagoDeSesion> {
  const [fila] = await ejecutarSP<PagoDeSesion>('SP_Pruebas_LeerPagoDeSesion', {
    IDSesionCheckout: { tipo: sql.Int, valor: idSesion },
  });
  if (fila === undefined) throw new Error('La sesión no existe');
  return fila;
}

export async function estadoEnPasarela(llave: string): Promise<string | undefined> {
  const [fila] = await ejecutarSP<{ Estado: string }>('SP_Pruebas_LeerPasarela', {
    LlaveIdempotencia: { tipo: sql.UniqueIdentifier, valor: llave },
  });
  return fila?.Estado;
}

const DIA_MS = 24 * 60 * 60 * 1000;

export interface LimitesCupon {
  limiteUsosTotal: number;
  limiteUsosPorCliente?: number;
}

/** Un cupón vigente de Q5.00 con los límites dados, creado por el Admin. */
export async function crearCupon(app: Express, tokenAdmin: string, limites: LimitesCupon) {
  const codigo = `K${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const respuesta = await request(app)
    .post('/api/v1/admin/cupones')
    .set(comoCliente(tokenAdmin))
    .send({
      codigo,
      descripcion: 'Cupón de checkout',
      tipo: 'MontoFijo',
      valor: '5.00',
      fechaInicio: new Date(Date.now() - DIA_MS).toISOString(),
      fechaFin: new Date(Date.now() + DIA_MS).toISOString(),
      ...limites,
    });
  return { codigo, idCupon: leerDatos(respuesta, z.object({ idCupon: z.number() })).idCupon };
}
