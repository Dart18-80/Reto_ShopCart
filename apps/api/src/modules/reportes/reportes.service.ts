import type { PaginaSP } from '../../shared/db/index.js';
import type { ReportesRepository } from './reportes.repository.js';
import type { ConsultaCarritos, ConsultaRango, ConsultaVentas } from './reportes.schemas.js';
import type {
  CarritoAbandonado,
  ProductoVendido,
  Resumen,
  VentasDeCategoria,
  VentasDelPeriodo,
} from './reportes.types.js';

interface Dependencias {
  repositorio: ReportesRepository;
}

// Casos de uso del dashboard (E7-H01). El SP agrega sobre la definición única de venta (M-07); este es el punto
// donde la Fase 5 pondrá la caché de los reportes (A-11).
export function crearReportesService({ repositorio }: Dependencias) {
  return {
    resumen: (consulta: ConsultaRango): Promise<Resumen> => repositorio.resumen(consulta),

    ventasPorPeriodo: (consulta: ConsultaVentas): Promise<VentasDelPeriodo[]> =>
      repositorio.ventasPorPeriodo(consulta),

    ventasPorCategoria: (consulta: ConsultaRango): Promise<VentasDeCategoria[]> =>
      repositorio.ventasPorCategoria(consulta),

    topProductos: (consulta: ConsultaRango): Promise<ProductoVendido[]> =>
      repositorio.topProductos(consulta),

    carritosAbandonados: (consulta: ConsultaCarritos): Promise<PaginaSP<CarritoAbandonado>> =>
      repositorio.carritosAbandonados(consulta),
  };
}

export type ReportesService = ReturnType<typeof crearReportesService>;
