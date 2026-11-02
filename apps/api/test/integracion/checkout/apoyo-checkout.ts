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
