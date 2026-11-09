import sql from 'mssql';
import { ejecutarSP, ejecutarSPConjuntos } from '../../shared/db/index.js';
import { aMonto } from '../../shared/dinero/index.js';
import type { ActualizarMetodo } from './envios.schemas.js';
import type { EnvioGratis, MetodoEnvio, MetodosParaCarrito } from './envios.types.js';

interface FilaMetodoParaCarrito {
  IDMetodoEnvio: number;
  Codigo: string;
  Nombre: string;
  DiasMin: number;
  DiasMax: number;
  Tarifa: number;
  Costo: number;
  EnvioGratis: boolean;
  TotalConEnvio: number;
}

interface FilaEnvioGratis {
  MontoMinimo: number | null;
  Faltante: number | null;
  Alcanzado: boolean | null;
}

interface FilaMinutosReserva {
  MinutosReserva: number;
}

interface FilaMetodo {
  IDMetodoEnvio: number;
  Codigo: string;
  Nombre: string;
  Costo: number;
  DiasMin: number;
  DiasMax: number;
  Activo: boolean;
}

function aEnvioGratis(fila: FilaEnvioGratis): EnvioGratis | null {
  return fila.MontoMinimo === null || fila.Faltante === null || fila.Alcanzado === null
    ? null
    : {
        montoMinimo: aMonto(fila.MontoMinimo),
        faltante: aMonto(fila.Faltante),
        alcanzado: fila.Alcanzado,
      };
}

const aMetodo = (fila: FilaMetodo): MetodoEnvio => ({
  idMetodoEnvio: fila.IDMetodoEnvio,
  codigo: fila.Codigo,
  nombre: fila.Nombre,
  costo: aMonto(fila.Costo),
  diasMin: fila.DiasMin,
  diasMax: fila.DiasMax,
  activo: fila.Activo,
});

export const enviosRepository = {
  /** N-04: el carrito sale de la sesión o del hash de la cookie, igual que en SP_Carrito_Obtener. */
  async listarParaCarrito(hash: Buffer | null): Promise<MetodosParaCarrito> {
    const [metodos, envios, parametros] = await ejecutarSPConjuntos<
      [FilaMetodoParaCarrito[], FilaEnvioGratis[], FilaMinutosReserva[]]
    >('SP_Envios_ListarMetodos', { HashTokenInvitado: { tipo: sql.Binary, valor: hash } });
    const envioGratis = envios?.[0];
    const reserva = parametros?.[0];
    if (metodos === undefined || envioGratis === undefined || reserva === undefined) {
      throw new Error(
        'SP_Envios_ListarMetodos no devolvió los métodos, el envío gratis y los minutos de la reserva',
      );
    }
    return {
      metodos: metodos.map((fila) => ({
        idMetodoEnvio: fila.IDMetodoEnvio,
        codigo: fila.Codigo,
        nombre: fila.Nombre,
        diasMin: fila.DiasMin,
        diasMax: fila.DiasMax,
        tarifa: aMonto(fila.Tarifa),
        costo: aMonto(fila.Costo),
        envioGratis: fila.EnvioGratis,
        totalConEnvio: aMonto(fila.TotalConEnvio),
      })),
      minutosReserva: reserva.MinutosReserva,
      envioGratis: aEnvioGratis(envioGratis),
    };
  },

  /** M9-H02: todos los métodos, también los inactivos, para el Admin. */
  async listarMetodosAdmin(): Promise<MetodoEnvio[]> {
    const filas = await ejecutarSP<FilaMetodo>('SP_Envios_ListarMetodosAdmin');
    return filas.map(aMetodo);
  },

  async actualizarMetodo(idMetodoEnvio: number, datos: ActualizarMetodo): Promise<MetodoEnvio> {
    const [fila] = await ejecutarSP<FilaMetodo>('SP_Envios_ActualizarMetodo', {
      IDMetodoEnvio: { tipo: sql.Int, valor: idMetodoEnvio },
      Nombre: { tipo: sql.NVarChar(50), valor: datos.nombre },
      Costo: { tipo: sql.Decimal(12, 2), valor: datos.costo },
      DiasMin: { tipo: sql.TinyInt, valor: datos.diasMin },
      DiasMax: { tipo: sql.TinyInt, valor: datos.diasMax },
      Activo: { tipo: sql.Bit, valor: datos.activo },
    });
    if (fila === undefined) throw new Error('SP_Envios_ActualizarMetodo no devolvió el método');
    return aMetodo(fila);
  },
};

export type EnviosRepository = typeof enviosRepository;
