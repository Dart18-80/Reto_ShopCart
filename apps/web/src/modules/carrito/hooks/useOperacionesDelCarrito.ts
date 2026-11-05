import { agregarLinea, cambiarCantidad, marcarAvisosVistos, quitarLinea } from '../carrito.api';
import { useMutacionDelCarrito } from './useMutacionDelCarrito';

export const useAgregarAlCarrito = () => useMutacionDelCarrito(agregarLinea);

export const useCambiarCantidad = (idLinea: number) =>
  useMutacionDelCarrito((cantidad: number) => cambiarCantidad(idLinea, { cantidad }));

export const useQuitarLinea = (idLinea: number) =>
  useMutacionDelCarrito<undefined>(() => quitarLinea(idLinea));

export const useMarcarAvisosVistos = () => useMutacionDelCarrito<undefined>(marcarAvisosVistos);
