import sql from 'mssql';
import { ejecutarSP } from '../../shared/db/index.js';
import { aMonto } from '../../shared/dinero/index.js';
import type { ActualizarConfiguracion } from './configuracion.schemas.js';
import type { Configuracion } from './configuracion.types.js';

interface FilaConfiguracion {
  DiasGarantiaPrecio: number;
  MinutosReserva: number;
  HorasCarritoAbandonado: number;
  DiasExpiracionCarritoInvitado: number;
  UmbralUltimasUnidades: number;
  MontoEnvioGratis: number | null;
  MaxIntentosPagoRechazados: number;
  DiasPlazoDevolucion: number;
  MaxLineasCarrito: number;
  FechaActualizacion: Date;
}

function unica(filas: FilaConfiguracion[], sp: string): Configuracion {
  const [fila] = filas;
  if (fila === undefined) throw new Error(`${sp} no devolvió los parámetros`);
  return {
    diasGarantiaPrecio: fila.DiasGarantiaPrecio,
    minutosReserva: fila.MinutosReserva,
    horasCarritoAbandonado: fila.HorasCarritoAbandonado,
    diasExpiracionCarritoInvitado: fila.DiasExpiracionCarritoInvitado,
    umbralUltimasUnidades: fila.UmbralUltimasUnidades,
    montoEnvioGratis: fila.MontoEnvioGratis === null ? null : aMonto(fila.MontoEnvioGratis),
    maxIntentosPagoRechazados: fila.MaxIntentosPagoRechazados,
    diasPlazoDevolucion: fila.DiasPlazoDevolucion,
    maxLineasCarrito: fila.MaxLineasCarrito,
    fechaActualizacion: fila.FechaActualizacion,
  };
}

export const configuracionRepository = {
  async obtener(): Promise<Configuracion> {
    return unica(
      await ejecutarSP<FilaConfiguracion>('SP_Configuracion_Obtener'),
      'SP_Configuracion_Obtener',
    );
  },

  // PATCH: un parámetro ausente va en NULL (sin cambio); null en montoEnvioGratis lo quita. Los tipos son
  // los de los parámetros del SP (TINYINT y SMALLINT).
  async actualizar(cambios: ActualizarConfiguracion): Promise<Configuracion> {
    const filas = await ejecutarSP<FilaConfiguracion>('SP_Configuracion_Actualizar', {
      DiasGarantiaPrecio: { tipo: sql.TinyInt, valor: cambios.diasGarantiaPrecio ?? null },
      MinutosReserva: { tipo: sql.SmallInt, valor: cambios.minutosReserva ?? null },
      HorasCarritoAbandonado: { tipo: sql.SmallInt, valor: cambios.horasCarritoAbandonado ?? null },
      DiasExpiracionCarritoInvitado: {
        tipo: sql.SmallInt,
        valor: cambios.diasExpiracionCarritoInvitado ?? null,
      },
      UmbralUltimasUnidades: { tipo: sql.SmallInt, valor: cambios.umbralUltimasUnidades ?? null },
      MontoEnvioGratis: { tipo: sql.Decimal(12, 2), valor: cambios.montoEnvioGratis ?? null },
      QuitarMontoEnvioGratis: { tipo: sql.Bit, valor: cambios.montoEnvioGratis === null },
      MaxIntentosPagoRechazados: {
        tipo: sql.TinyInt,
        valor: cambios.maxIntentosPagoRechazados ?? null,
      },
      DiasPlazoDevolucion: { tipo: sql.SmallInt, valor: cambios.diasPlazoDevolucion ?? null },
      MaxLineasCarrito: { tipo: sql.SmallInt, valor: cambios.maxLineasCarrito ?? null },
    });
    return unica(filas, 'SP_Configuracion_Actualizar');
  },
};

export type ConfiguracionRepository = typeof configuracionRepository;
