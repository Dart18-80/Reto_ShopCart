import type { ActualizarCantidad, AgregarLinea, AplicarCupon } from '@shopcart/shared';
import { api, ErrorApi, type Respuesta } from '../../shared/api';

export type Carrito = Respuesta<'/api/v1/carrito', 'get'>['datos'];
export type LineaCarrito = Carrito['lineas'][number];

// El middleware de errores ya convirtió toda respuesta de error en ErrorApi: un 2xx sin cuerpo es inesperado.
function carritoDe(data: { datos: Carrito } | undefined): Carrito {
  if (!data) throw ErrorApi.inesperado();
  return data.datos;
}

// N-05: el invitado se identifica con su cookie carrito_invitado; el navegador la manda sola (mismo origen, A-03).

export async function obtenerCarrito(): Promise<Carrito> {
  const { data } = await api.GET('/api/v1/carrito');
  return carritoDe(data);
}

export async function agregarLinea(linea: AgregarLinea): Promise<Carrito> {
  const { data } = await api.POST('/api/v1/carrito/lineas', { body: linea });
  return carritoDe(data);
}

export async function cambiarCantidad(
  idLinea: number,
  cuerpo: ActualizarCantidad,
): Promise<Carrito> {
  const { data } = await api.PATCH('/api/v1/carrito/lineas/{idLinea}', {
    params: { path: { idLinea } },
    body: cuerpo,
  });
  return carritoDe(data);
}

export async function quitarLinea(idLinea: number): Promise<Carrito> {
  const { data } = await api.DELETE('/api/v1/carrito/lineas/{idLinea}', {
    params: { path: { idLinea } },
  });
  return carritoDe(data);
}

export async function marcarAvisosVistos(): Promise<Carrito> {
  const { data } = await api.POST('/api/v1/carrito/avisos/vistos');
  return carritoDe(data);
}

export async function aplicarCupon(cupon: AplicarCupon): Promise<Carrito> {
  const { data } = await api.PUT('/api/v1/carrito/cupon', { body: cupon });
  return carritoDe(data);
}

export async function quitarCupon(): Promise<Carrito> {
  const { data } = await api.DELETE('/api/v1/carrito/cupon');
  return carritoDe(data);
}
