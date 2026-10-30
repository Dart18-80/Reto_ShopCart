import sql from 'mssql';
import { ejecutarSP, type NombreSP, type ParametrosSP } from '../../src/shared/db/index.js';

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
