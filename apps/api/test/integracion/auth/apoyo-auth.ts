import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import sql from 'mssql';
import request, { type Response } from 'supertest';
import { z } from 'zod';
import { ejecutarSP } from '../../../src/shared/db/index.js';

export const CONTRASENA = 'Clave2026';

const sesionSchema = z.object({
  datos: z.object({
    accessToken: z.string(),
    expiraEn: z.number(),
    usuario: z.object({
      idUsuario: z.number(),
      correo: z.string(),
      nombre: z.string(),
      rol: z.string(),
    }),
  }),
});

export type SesionRecibida = z.infer<typeof sesionSchema>['datos'];

export const correoUnico = (): string => `prueba-${randomUUID()}@shopcart.test`;

export function leerSesion(respuesta: Response): SesionRecibida {
  return sesionSchema.parse(respuesta.body).datos;
}

/** El Set-Cookie del refresh token, o undefined si la respuesta no lo trae. */
export function cookieRefresh(respuesta: Response): string | undefined {
  const cabecera: unknown = respuesta.headers['set-cookie'];
  const cookies = Array.isArray(cabecera) ? cabecera.filter((c) => typeof c === 'string') : [];
  return cookies.find((cookie) => cookie.startsWith('refresh='));
}

/** Solo el valor del refresh token, sin atributos. */
export function valorRefresh(respuesta: Response): string {
  const cookie = cookieRefresh(respuesta);
  const valor = cookie?.split(';')[0]?.slice('refresh='.length);
  if (valor === undefined || valor.length === 0)
    throw new Error('La respuesta no trae el refresh token');
  return decodeURIComponent(valor);
}

export function registrar(app: Express, correo: string = correoUnico(), contrasena = CONTRASENA) {
  return request(app)
    .post('/api/v1/auth/registro')
    .send({ correo, contrasena, nombre: 'Cliente de prueba' });
}

export function iniciarSesion(app: Express, correo: string, contrasena = CONTRASENA) {
  return request(app).post('/api/v1/auth/login').send({ correo, contrasena });
}

export interface FilaRefresh {
  IDFamilia: string;
  HashToken: Buffer;
  FechaUso: Date | null;
  FechaRevocacion: Date | null;
  MotivoRevocacion: string | null;
}

export function leerRefreshTokens(idUsuario: number): Promise<FilaRefresh[]> {
  return ejecutarSP<FilaRefresh>('SP_Pruebas_LeerRefreshTokens', {
    IDUsuario: { tipo: sql.Int, valor: idUsuario },
  });
}
