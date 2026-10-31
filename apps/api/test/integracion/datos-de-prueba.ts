import { randomUUID } from 'node:crypto';
import sql from 'mssql';
import { expect } from 'vitest';
import { ejecutarSP, type NombreSP, type ParametrosSP } from '../../src/shared/db/index.js';
import { ejecutarConContexto, type Rol } from '../../src/shared/http/index.js';

export const ERROR_DE_CONSTRAINT = 547;
export const ERROR_DE_INDICE_UNICO = 2601;

/** Ejecuta un SP de prueba que devuelve una sola fila y falla si no la devuelve. */
export async function unaFila<T>(nombre: NombreSP, parametros?: ParametrosSP): Promise<T> {
  const [fila] = await ejecutarSP<T>(nombre, parametros);
  if (fila === undefined) throw new Error(`${nombre} no devolvió ninguna fila`);
  return fila;
}

export interface VarianteDePrueba {
  IDVariante: number;
  IDUsuario: number;
  IDTipoEntrada: number;
  IDTipoSalida: number;
}

export function crearVariante(): Promise<VarianteDePrueba> {
  return unaFila<VarianteDePrueba>('SP_Pruebas_CrearVariante');
}

export async function crearUsuario(): Promise<number> {
  return (await unaFila<{ IDUsuario: number }>('SP_Pruebas_CrearUsuario')).IDUsuario;
}

export async function crearSesionCheckout(idUsuario: number): Promise<number> {
  const fila = await unaFila<{ IDSesionCheckout: number }>('SP_Pruebas_CrearSesionCheckout', {
    IDUsuario: { tipo: sql.Int, valor: idUsuario },
  });
  return fila.IDSesionCheckout;
}

export async function crearPedido(idUsuario: number): Promise<number> {
  const fila = await unaFila<{ IDPedido: number }>('SP_Pruebas_CrearPedido', {
    IDUsuario: { tipo: sql.Int, valor: idUsuario },
  });
  return fila.IDPedido;
}

export async function crearCupon(limiteUsosTotal: number): Promise<number> {
  const fila = await unaFila<{ IDCupon: number }>('SP_Pruebas_CrearCupon', {
    LimiteUsosTotal: { tipo: sql.Int, valor: limiteUsosTotal },
  });
  return fila.IDCupon;
}

/** Ejecuta la acción como si fuera una petición del usuario y rol indicados (A-18). */
export function comoActor<T>(
  idUsuario: number,
  rol: Rol,
  accion: () => Promise<T>,
  requestId: string = randomUUID(),
): Promise<T> {
  return ejecutarConContexto({ requestId, idUsuario, rol }, accion);
}

export interface FilaBitacora {
  Modulo: string;
  Entidad: string;
  IDEntidad: string;
  Accion: string;
  ValorAnterior: string | null;
  ValorNuevo: string | null;
  IDUsuario: number | null;
  RequestId: string | null;
  Fecha: Date;
}

/** La bitácora de una entidad, de la fila más reciente a la más antigua. */
export function leerBitacora(entidad: string, idEntidad: number): Promise<FilaBitacora[]> {
  return ejecutarSP<FilaBitacora>('SP_Pruebas_LeerBitacora', {
    Entidad: { tipo: sql.VarChar(50), valor: entidad },
    IDEntidad: { tipo: sql.VarChar(50), valor: String(idEntidad) },
  });
}

export function ultimaBitacora(entidad: string, idEntidad: number): Promise<FilaBitacora> {
  return unaFila<FilaBitacora>('SP_Pruebas_LeerBitacora', {
    Entidad: { tipo: sql.VarChar(50), valor: entidad },
    IDEntidad: { tipo: sql.VarChar(50), valor: String(idEntidad) },
  });
}

export function fijarExistencia(idVariante: number, existenciaFisica: number) {
  return ejecutarSP('SP_Pruebas_FijarExistencia', {
    IDVariante: { tipo: sql.Int, valor: idVariante },
    ExistenciaFisica: { tipo: sql.Int, valor: existenciaFisica },
  });
}

/** Cierra el precio vigente e inserta otro; devuelve el IDPrecioVariante de la nueva versión. */
export async function cambiarPrecio(idVariante: number, precio: string): Promise<number> {
  const fila = await unaFila<{ IDPrecioVariante: number }>('SP_Pruebas_CambiarPrecioVariante', {
    IDVariante: { tipo: sql.Int, valor: idVariante },
    Precio: { tipo: sql.Decimal(12, 2), valor: precio },
  });
  return fila.IDPrecioVariante;
}

/** Para toMatchObject: el error de SQL Server de un constraint con su nombre. */
export function violaConstraint(nombre: string, numero: number = ERROR_DE_CONSTRAINT) {
  return { number: numero, message: expect.stringContaining(nombre) as unknown };
}
