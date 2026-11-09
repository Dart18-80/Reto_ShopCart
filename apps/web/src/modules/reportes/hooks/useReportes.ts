import type { ConsultaCarritos, ConsultaVentas, RangoDeFechas } from '@shopcart/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  listarCarritosAbandonados,
  obtenerResumen,
  obtenerTopProductos,
  obtenerVentas,
  obtenerVentasPorCategoria,
} from '../reportes.api';
import { reportesKeys } from '../reportes.keys';

// Cada reporte es su propia consulta: uno que falla no tumba a los demás (05 §11). Al cambiar el rango se conservan
// los datos anteriores mientras llegan los nuevos.

export const useResumen = (rango: RangoDeFechas) =>
  useQuery({
    queryKey: reportesKeys.resumen(rango),
    queryFn: () => obtenerResumen(rango),
    placeholderData: keepPreviousData,
  });

export const useVentas = (consulta: ConsultaVentas) =>
  useQuery({
    queryKey: reportesKeys.ventas(consulta),
    queryFn: () => obtenerVentas(consulta),
    placeholderData: keepPreviousData,
  });

export const useVentasPorCategoria = (rango: RangoDeFechas) =>
  useQuery({
    queryKey: reportesKeys.categorias(rango),
    queryFn: () => obtenerVentasPorCategoria(rango),
    placeholderData: keepPreviousData,
  });

export const useTopProductos = (rango: RangoDeFechas) =>
  useQuery({
    queryKey: reportesKeys.top(rango),
    queryFn: () => obtenerTopProductos(rango),
    placeholderData: keepPreviousData,
  });

export const useCarritosAbandonados = (consulta: ConsultaCarritos) =>
  useQuery({
    queryKey: reportesKeys.carritos(consulta),
    queryFn: () => listarCarritosAbandonados(consulta),
    placeholderData: keepPreviousData,
  });
